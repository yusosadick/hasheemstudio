// jobs.error_message is shown to the user, so it must never carry encoder command lines, file paths or tool
// output (that would publish exactly the tuning we keep private). Our own friendly messages pass through; anything
// that looks like raw tool output is replaced. The raw text stays in job_attempts.error_message for operators.
export const GENERIC_PROCESSING_ERROR =
  "We couldn’t process this video. It may use a format or track we can’t read yet. Please try again, or re-export the video and upload it again.";

const LEAK = /ffmpeg|ffprobe|command failed|\/scratch\/|libx\d|x264|-crf\b|-preset\b|maxrate|bufsize|zscale|tonemap|codec parameters|analyzeduration|probesize|stream #\d|decoder \(codec|decodeOk=|durationOk=|\[(mov|mp4|matroska|h264|hevc|aac)[^\]]*@/i;

export function toUserFacingError(message: string): string {
  const text = String(message ?? "").trim();
  if (!text || LEAK.test(text)) return GENERIC_PROCESSING_ERROR;
  return text.slice(0, 600);
}
