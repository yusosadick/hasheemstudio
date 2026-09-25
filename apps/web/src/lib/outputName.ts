// Output files are named hasheemstudio_YYYYMMDD_HHmmss.mp4 in the user's LOCAL time, taken from when the
// video finished processing (stable across repeat downloads). The API only accepts this exact shape.
const pad = (n: number) => String(n).padStart(2, "0");

export function formatOutputFileName(completedAt: string | number | Date | null | undefined): string {
  const d = completedAt ? new Date(completedAt) : new Date();
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  return `hasheemstudio_${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}_${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.mp4`;
}
