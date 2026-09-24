import test from "node:test";
import assert from "node:assert/strict";
import { planPlatformProfile, choosePreset, MIN_VIDEO_KBPS, INSTAGRAM_MAX_VIDEO_KBPS } from "./platformProfile.js";
import { displayDimensions } from "./ffmpeg.js";

const plan = (w: number, h: number, fps: number | null, kbps: number | null = null) =>
  planPlatformProfile({ displayWidth: w, displayHeight: h, frameRate: fps, sourceVideoKbps: kbps });

test("ceilings match the published YouTube 1080p/720p/480p anchors at 30 and 60 fps", () => {
  assert.equal(plan(1920, 1080, 30).tierCeilingKbps, 8000);
  assert.equal(plan(1920, 1080, 60).tierCeilingKbps, 12000);
  assert.equal(plan(1280, 720, 30).tierCeilingKbps, 5000);
  assert.equal(plan(1280, 720, 60).tierCeilingKbps, 7500);
  assert.equal(plan(854, 480, 30).tierCeilingKbps, 2500);
  assert.equal(plan(854, 480, 60).tierCeilingKbps, 4000);
});

test("targets differ per resolution/frame rate instead of one hardcoded number", () => {
  const ceilings = new Set([plan(1280, 720, 30), plan(1920, 1080, 30), plan(1920, 1080, 60), plan(640, 360, 30)].map((p) => p.maxrateKbps));
  assert.equal(ceilings.size, 4);
});

test("frame rates between 30 and 60 interpolate; 29.97 and 59.94 land on the anchors' neighbourhood", () => {
  assert.equal(plan(1920, 1080, 45).tierCeilingKbps, 10000);
  assert.equal(plan(1920, 1080, 29.97).tierCeilingKbps, 8000);
  assert.ok(Math.abs(plan(1920, 1080, 59.94).tierCeilingKbps - 12000) <= 10);
});

test("never upscales and does not resize a source already within 1080p60", () => {
  const p = plan(1280, 720, 30);
  assert.deepEqual([p.outWidth, p.outHeight, p.downscaled], [1280, 720, false]);
  const q = plan(1920, 1080, 60);
  assert.deepEqual([q.outWidth, q.outHeight, q.downscaled], [1920, 1080, false]);
});

test("4K landscape and 4K portrait are shrunk to the 1080p ceiling with exact aspect ratio", () => {
  const land = plan(3840, 2160, 30);
  assert.deepEqual([land.outWidth, land.outHeight, land.downscaled], [1920, 1080, true]);
  const port = plan(2160, 3840, 30);
  assert.deepEqual([port.outWidth, port.outHeight, port.downscaled], [1080, 1920, true]);
});

test("odd ratios stay even-sized (x264 yuv420p requirement)", () => {
  const p = plan(2560, 1440, 30);
  assert.equal(p.outWidth % 2, 0);
  assert.equal(p.outHeight % 2, 0);
  assert.ok(p.outWidth <= 1920 && p.outHeight <= 1080);
});

test("frame rates above 60 are capped to 60; up to 60.5 is left alone", () => {
  assert.deepEqual([plan(1920, 1080, 120).outFps, plan(1920, 1080, 120).fpsCapped], [60, true]);
  assert.equal(plan(1920, 1080, 60).fpsCapped, false);
  assert.equal(plan(1920, 1080, 59.94).fpsCapped, false);
});

test("unknown frame rate falls back to 30 rather than failing", () => {
  assert.equal(plan(1920, 1080, null).outFps, 30);
});

test("ceiling is never planned above 90% of the source bitrate (no inflating small files) but never below TikTok's 516 kbps minimum", () => {
  assert.equal(plan(1920, 1080, 60, 4000).maxrateKbps, 3600);
  assert.equal(plan(1920, 1080, 30, 90_000).maxrateKbps, 8000);
  assert.equal(plan(1920, 1080, 30, 300).maxrateKbps, MIN_VIDEO_KBPS);
});

test("every planned ceiling stays under Instagram's published 25 Mbps maximum", () => {
  for (const [w, h, f] of [[3840, 2160, 60], [1920, 1080, 60], [1080, 1920, 30]] as const) {
    assert.ok(plan(w, h, f, 200_000).maxrateKbps <= INSTAGRAM_MAX_VIDEO_KBPS);
  }
});

test("bufsize is one second of ceiling with a half-full start; GOP is ~2 seconds", () => {
  const p = plan(1920, 1080, 30, 90_000);
  assert.equal(p.bufsizeKbps, p.maxrateKbps);
  assert.equal(p.vbvInit, 0.5);
  assert.equal(p.gopFrames, 60);
  assert.equal(plan(1920, 1080, 60).gopFrames, 120);
});

test("rotation swaps display dimensions for 90/270 only (including negative and >360 values)", () => {
  assert.deepEqual(displayDimensions(3840, 2160, 90), { width: 2160, height: 3840 });
  assert.deepEqual(displayDimensions(3840, 2160, -90), { width: 2160, height: 3840 });
  assert.deepEqual(displayDimensions(3840, 2160, 270), { width: 2160, height: 3840 });
  assert.deepEqual(displayDimensions(3840, 2160, 450), { width: 2160, height: 3840 });
  assert.deepEqual(displayDimensions(3840, 2160, 0), { width: 3840, height: 2160 });
  assert.deepEqual(displayDimensions(3840, 2160, 180), { width: 3840, height: 2160 });
});

test("a plan for the real rotated 4K drone clip uses display size, not coded size", () => {
  const d = displayDimensions(3840, 2160, 90);
  const p = plan(d.width!, d.height!, 29.97, 91_218);
  assert.deepEqual([p.outWidth, p.outHeight], [1080, 1920]);
});

const work = (seconds: number, w: number, h: number, fps: number) => ({ durationSeconds: seconds, inputWidth: w, inputHeight: h, inputFps: fps });

test("short 1080p clips use `faster`; long 1080p60 clips fall back to `veryfast`; never superfast/ultrafast", () => {
  const p60 = plan(1920, 1080, 60);
  const short = choosePreset(p60, work(10, 1920, 1080, 60));
  assert.deepEqual(short.ok && short.preset, "faster");
  const long = choosePreset(p60, work(120, 1920, 1080, 60));
  assert.deepEqual(long.ok && long.preset, "veryfast");
});

test("the real 4K drone clip (5 s, 4K HEVC in, 1080p out) is planned with `faster` and a plausible prediction", () => {
  const p = plan(2160, 3840, 29.97, 91_218);
  const c = choosePreset(p, work(5.14, 3840, 2160, 29.97));
  assert.ok(c.ok && c.preset === "faster");
  assert.ok(c.predictedSeconds > 10 && c.predictedSeconds < 120);
});

test("a 10-minute 4K clip is refused up front instead of failing after eight-minute attempts", () => {
  const p = plan(3840, 2160, 30, 60_000);
  assert.equal(choosePreset(p, work(600, 3840, 2160, 30)).ok, false);
});

test("free-tier ceiling (2 minutes of 1080p60) is always accepted", () => {
  const p = plan(1920, 1080, 60, 6700);
  assert.equal(choosePreset(p, work(120, 1920, 1080, 60)).ok, true);
});
