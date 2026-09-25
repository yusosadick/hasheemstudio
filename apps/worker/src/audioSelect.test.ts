import test from "node:test";
import assert from "node:assert/strict";
import { pickAudioStream } from "./ffmpeg.js";
import { toUserFacingError, GENERIC_PROCESSING_ERROR } from "./userError.js";

// The real IMG_5475.MOV layout from a recent iPhone: HEVC video, spatial "apac" (undecodable), stereo AAC, metadata track.
const iphone = [
  { index: 0, codec_type: "video", codec_name: "hevc" },
  { index: 1, codec_type: "audio", codec_name: "unknown", channels: 4 },
  { index: 2, codec_type: "audio", codec_name: "aac", channels: 2 },
  { index: 3, codec_type: "data", codec_name: "unknown" },
];
test("skips Apple spatial audio and uses the stereo AAC track", () => {
  const p = pickAudioStream(iphone);
  assert.deepEqual(p, { index: 2, codec: "aac", skipped: 1 });
});
test("plain single AAC track", () => {
  assert.deepEqual(pickAudioStream([{ index: 0, codec_type: "video" }, { index: 1, codec_type: "audio", codec_name: "aac", channels: 2 }]), { index: 1, codec: "aac", skipped: 0 });
});
test("no audio at all", () => {
  assert.deepEqual(pickAudioStream([{ index: 0, codec_type: "video" }]), { index: null, codec: null, skipped: 0 });
});
test("only unreadable audio is dropped, not fatal", () => {
  assert.deepEqual(pickAudioStream([{ index: 0, codec_type: "video" }, { index: 1, codec_type: "audio", codec_name: "unknown", channels: 4 }]), { index: null, codec: null, skipped: 1 });
});
test("prefers the stereo compatibility mix over surround", () => {
  const p = pickAudioStream([{ index: 1, codec_type: "audio", codec_name: "ac3", channels: 6 }, { index: 2, codec_type: "audio", codec_name: "aac", channels: 2 }]);
  assert.equal(p.index, 2);
});
test("error text never leaks encoder settings, paths or tool output", () => {
  const raw = "Command failed: ffmpeg -nostdin -y -i /scratch/3335e30e/input -crf 23 -maxrate 8000k -x264-params vbv-init=0.5 [mov,mp4 @ 0x5f31f860cfc0] Could not find codec parameters for stream 1";
  assert.equal(toUserFacingError(raw), GENERIC_PROCESSING_ERROR);
  assert.equal(toUserFacingError("Output verification failed: decodeOk=true durationOk=false"), GENERIC_PROCESSING_ERROR);
  const friendly = "Your video file appears to be corrupted or incomplete. Please re-export it.";
  assert.equal(toUserFacingError(friendly), friendly);
  for (const w of ["crf", "maxrate", "x264", "scratch", "ffmpeg"]) assert(!GENERIC_PROCESSING_ERROR.toLowerCase().includes(w));
});
