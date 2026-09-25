import test from "node:test";
import assert from "node:assert/strict";
import { publicErrorMessage, GENERIC_PROCESSING_ERROR } from "./publicError.js";

test("raw tool output stored on old failed jobs is never sent to the browser", () => {
  const raw = "Command failed: ffmpeg -nostdin -y -v warning -i /scratch/x/input -map 0:v:0 -crf 23 -maxrate 8000k -bufsize 8000k -x264-params vbv-init=0.5 -g 60";
  assert.equal(publicErrorMessage(raw), GENERIC_PROCESSING_ERROR);
  assert.equal(publicErrorMessage("Output verification failed: decodeOk=true durationOk=false"), GENERIC_PROCESSING_ERROR);
});
test("friendly messages, null and empty pass through correctly", () => {
  assert.equal(publicErrorMessage(null), null);
  assert.equal(publicErrorMessage(""), null);
  assert.equal(publicErrorMessage("This video is too long."), "This video is too long.");
});
