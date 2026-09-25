// Defence in depth: older failed jobs (and any future worker bug) may hold raw tool output in error_message.
// The browser only ever receives a sanitised message — never command lines, paths or encoder settings.
export const GENERIC_PROCESSING_ERROR =
  "We couldn’t process this video. It may use a format or track we can’t read yet. Please try again, or re-export the video and upload it again.";

const LEAK = /ffmpeg|ffprobe|command failed|\/scratch\/|libx\d|x264|-crf\b|-preset\b|maxrate|bufsize|zscale|tonemap|codec parameters|analyzeduration|probesize|stream #\d|decoder \(codec|decodeOk=|durationOk=|\[(mov|mp4|matroska|h264|hevc|aac)[^\]]*@/i;

export function publicErrorMessage(message: string | null | undefined): string | null {
  if (message === null || message === undefined || message === "") return null;
  return LEAK.test(message) ? GENERIC_PROCESSING_ERROR : String(message).slice(0, 600);
}
