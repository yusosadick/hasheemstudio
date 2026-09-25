import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeFtyp } from "./mp4Compat.js";

function ftyp(major: string, minor: number, brands: string[]): Buffer {
  const b = Buffer.alloc(16 + brands.length * 4);
  b.writeUInt32BE(b.length, 0); b.write("ftyp", 4, "latin1"); b.write(major, 8, "latin1"); b.writeUInt32BE(minor, 12);
  brands.forEach((x, i) => b.write(x, 16 + i * 4, "latin1"));
  return b;
}

// The header of the file that TikTok rejected: major isom, compatible isom, dby1 (Dolby Vision!), iso2, avc1, mp41.
const REAL = () => ftyp("isom", 512, ["isom", "dby1", "iso2", "avc1", "mp41"]);
test("removes the Dolby Vision brand from a re-encoded H.264 file's header", () => {
  const before = REAL();
  const size = before.length;
  const r = sanitizeFtyp(before)!;
  assert.equal(r.changed, true);
  assert(!r.brands.includes("dby1"));
  assert.deepEqual(r.brands, ["isom", "mp42", "iso2", "avc1", "mp41"]);
  assert.equal(before.readUInt32BE(0), size, "box size (and therefore faststart offsets) unchanged");
  assert.equal(before.toString("latin1", 4, 8), "ftyp");
  assert(!before.toString("latin1").includes("dby1"));
});
test("leaves an already-clean header alone", () => {
  const r = sanitizeFtyp(ftyp("mp42", 0, ["mp42", "isom", "iso2", "avc1"]))!;
  assert.equal(r.changed, false);
});
test("QuickTime / Dolby major brand becomes isom; non-ftyp input is ignored", () => {
  const r = sanitizeFtyp(ftyp("qt  ", 0, ["qt  "]))!;
  assert.equal(r.major, "isom");
  assert.equal(sanitizeFtyp(Buffer.from("not an mp4 file at all, sorry")), null);
});
