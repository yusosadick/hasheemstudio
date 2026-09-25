// Container hygiene applied to every file we deliver.
//
// iPhone HDR clips are Dolby Vision (profile 8.4 over HLG). ffmpeg carries the "dby1" compatible brand from the
// source into the MP4 header even when the video is re-encoded to plain H.264 with no Dolby Vision data at all.
// Decoders that key off that brand (many Samsung/Android players and TikTok's importer) then take a Dolby Vision path
// for a stream that has none and reject the file ("Couldn't decode"). We rewrite such brands in place (same length,
// so faststart offsets are untouched) so the header only ever describes what is really in the file.
import { open } from "node:fs/promises";

const DOLBY_BRANDS = new Set(["dby1", "dvhe", "dvh1", "dav1"]);
const SAFE_MAJOR = "isom";
const REPLACEMENT = "mp42";

export interface FtypResult { changed: boolean; major: string; brands: string[] }

/** Pure: rewrites Dolby brands in a buffer that starts with an ftyp box. Returns null if it is not an ftyp box. */
export function sanitizeFtyp(head: Buffer): FtypResult | null {
  if (head.length < 16 || head.toString("latin1", 4, 8) !== "ftyp") return null;
  const size = head.readUInt32BE(0);
  if (size < 16 || size > head.length || size % 4 !== 0) return null;
  let changed = false;
  let major = head.toString("latin1", 8, 12);
  if (DOLBY_BRANDS.has(major) || major === "qt  ") { head.write(SAFE_MAJOR, 8, "latin1"); major = SAFE_MAJOR; changed = true; }
  const brands: string[] = [];
  for (let off = 16; off + 4 <= size; off += 4) {
    const brand = head.toString("latin1", off, off + 4);
    if (DOLBY_BRANDS.has(brand)) { head.write(REPLACEMENT, off, "latin1"); brands.push(REPLACEMENT); changed = true; }
    else brands.push(brand);
  }
  return { changed, major, brands };
}

/** Patches the delivered file's ftyp box in place. Returns the brands now in the header (or null if no ftyp). */
export async function sanitizeMp4Brands(path: string): Promise<FtypResult | null> {
  const fh = await open(path, "r+");
  try {
    const head = Buffer.alloc(256);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    const result = sanitizeFtyp(head.subarray(0, bytesRead));
    if (result?.changed) await fh.write(head, 0, Math.min(bytesRead, head.readUInt32BE(0)), 0);
    return result;
  } finally { await fh.close(); }
}
