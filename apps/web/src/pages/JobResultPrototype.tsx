import { IconCheckCircle, IconDownload, IconAlertTriangle } from "../components/Icons";

const rows = [
  { label: "Container", original: "MOV (QuickTime)", output: "MP4 (ISO BMFF)" },
  { label: "Video codec", original: "H.264 High@4.1", output: "H.264 High@4.1 (unchanged)" },
  { label: "Resolution", original: "1080×1920", output: "1080×1920 (unchanged)" },
  { label: "Frame rate", original: "29.97 VFR", output: "29.97 VFR (unchanged)" },
  { label: "Audio", original: "AAC-LC, 2ch", output: "AAC-LC, 2ch (unchanged)" },
  { label: "Rotation metadata", original: "90°, applied via matrix", output: "Normalised, matrix cleared" },
];

export default function JobResultPrototype() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        Design prototype — sample data, not a real job
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Job complete</h1>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
          <IconCheckCircle width={16} height={16} /> Remux only — no re-encode
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground-muted">
        This file was remuxed, not re-encoded: streams were copied into a compatible container.
        No frames were regenerated and no detail was added.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface1 p-4">
          <p className="text-sm font-medium">Original</p>
          <div className="mt-2 flex aspect-video items-center justify-center rounded-md bg-surface2 text-sm text-foreground-muted">
            Video preview placeholder
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface1 p-4">
          <p className="text-sm font-medium">Output</p>
          <div className="mt-2 flex aspect-video items-center justify-center rounded-md bg-surface2 text-sm text-foreground-muted">
            Video preview placeholder
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-foreground-muted">
        Comparison remains usable without colour perception and without autoplay audio.
      </p>

      <div className="mt-10">
        <h2 className="text-lg font-medium">What changed</h2>

        {/* Table on wider screens */}
        <table className="mt-4 hidden w-full text-left text-sm sm:table">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-2 pr-4 font-medium">Property</th>
              <th className="py-2 pr-4 font-medium">Original</th>
              <th className="py-2 font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{r.label}</td>
                <td className="py-2 pr-4 text-foreground-muted">{r.original}</td>
                <td className="py-2 text-foreground-muted">{r.output}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Cards on phones */}
        <div className="mt-4 flex flex-col gap-3 sm:hidden">
          {rows.map((r) => (
            <div key={r.label} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="mt-1 text-xs text-foreground-muted">Original: {r.original}</p>
              <p className="text-xs text-foreground-muted">Output: {r.output}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
        <IconAlertTriangle className="mt-0.5 shrink-0 text-warning" width={20} height={20} />
        <p className="text-sm">
          Verification level: <strong>sampled decode check</strong> (not a full frame-by-frame
          comparison). See the technical report for exactly what was and wasn&apos;t verified.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
        <p className="text-sm text-foreground-muted">
          Available for download for <strong className="text-foreground">6 days, 22 hours</strong>{" "}
          — then permanently deleted from our storage.
        </p>
        <a
          href="#"
          className="inline-flex min-h-touch items-center gap-2 rounded-md bg-gradient-primary px-6 text-sm font-medium text-foreground-on-accent hover:opacity-90"
        >
          <IconDownload width={18} height={18} />
          Download output
        </a>
      </div>
    </div>
  );
}
