# tests/fixtures/media

Licensed/generated media fixtures for the worker/inspector test matrix (per
`docs/ARCHITECTURE.md` "Output verification"). No fixture here is ever a copyrighted clip pulled
from the internet — each is either self-generated via FFmpeg synthetic test sources or explicitly
licensed for redistribution.

## `synthetic-remux-test.mov`

640x360, 5 seconds, 30fps, H.264 + AAC, generated entirely synthetically (no real-world footage):

```bash
ffmpeg -y -f lavfi -i "testsrc=duration=5:size=640x360:rate=30" \
       -f lavfi -i "sine=frequency=1000:duration=5" \
       -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
       tests/fixtures/media/synthetic-remux-test.mov
```

Used by `tests/e2e/upload-to-download.mjs` and `tests/integration/worker-crash-recovery.mjs` as
the real fixture uploaded through the real API, processed by the real worker, and downloaded.

## Still needed (matrix coverage, per `docs/ARCHITECTURE.md`)

Portrait/rotated, VFR, silent, multiple audio tracks, SDR/HDR, corrupted, and near-limit-size
fixtures — not yet added. Each compatibility-encode/HDR-policy test in Phase 5 should add the
fixture it actually needs, generated the same synthetic way.
