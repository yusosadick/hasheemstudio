import { IconUploadCloud } from "../components/Icons";
import { ArrowRight, BadgeCheck, FileCheck, FileVideo, Gauge, MonitorSmartphone, ScanSearch, ShieldCheck } from "lucide-react";

const benefits = [
  { icon: ShieldCheck, marker: "01", title: "Private & secure", body: "Your file stays tied to your account." },
  { icon: Gauge, marker: "02", title: "Fast when possible", body: "Compatible files use a quick remux." },
  { icon: MonitorSmartphone, marker: "03", title: "Made for video", body: "MP4 and MOV, up to 1080p60 free." },
  { icon: BadgeCheck, marker: "04", title: "Honest results", body: "Every transformation is explained." },
];

export default function Landing() {
  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(233,30,99,0.10),transparent_42%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-5 sm:px-6 sm:pb-16">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-foreground-muted">
            <a href="/" className="transition-colors hover:text-foreground">Home</a>
            <span aria-hidden="true">›</span><span>Video tools</span><span aria-hidden="true">›</span>
            <span className="text-foreground">Prepare video</span>
          </nav>

          <div className="mx-auto mt-8 max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Hasheem Studio video tools</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Prepare your video for upload</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-foreground-muted sm:text-base">
              Inspect, fix compatibility issues, and create a platform-ready video—with a clear report of exactly what changed.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-border bg-surface1/95 p-3 shadow-2xl shadow-black/30 sm:p-4">
            <div className="rounded-xl border-2 border-dashed border-border bg-background/60 px-5 py-8 text-center sm:px-8 sm:py-9">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent-text">
                <IconUploadCloud width={25} height={25} />
              </span>
              <h2 className="mt-4 text-lg font-semibold">Drop your video here</h2>
              <p className="mt-1 text-sm text-foreground-muted">or select it from your device</p>
              <a href="/signup" className="mt-5 inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-gradient-primary px-7 text-sm font-semibold text-foreground-on-accent shadow-lg shadow-accent/10 transition hover:opacity-90">
                <IconUploadCloud width={18} height={18} /> Choose video
              </a>
              <p className="mt-3 text-xs text-foreground-muted">MP4 or MOV · Up to 100 MB and 2 minutes on the free plan</p>

              <div id="how-it-works" className="mx-auto mt-8 max-w-3xl border-t border-border pt-7 text-left">
                <div className="text-center">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-text">What happens next</p>
                  <h3 className="mt-2 text-lg font-semibold">From original file to upload-ready video</h3>
                  <p className="mt-1 text-xs text-foreground-muted">One clear process. One finished video. A report of every change.</p>
                </div>

                <ol className="mt-6 grid gap-3 md:grid-cols-3">
                  <li className="relative rounded-lg border border-border bg-surface1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-accent-text"><FileVideo size={20} strokeWidth={1.75} /></span>
                      <span className="font-mono text-[10px] text-foreground-muted">01 / ORIGINAL</span>
                    </div>
                    <h4 className="mt-4 text-sm font-semibold">We inspect your source</h4>
                    <p className="mt-1 text-xs leading-5 text-foreground-muted">We read the codec, frame rate, rotation, colour data, duration, and resolution.</p>
                    <span className="mt-3 inline-flex rounded border border-border px-2 py-1 font-mono text-[9px] text-foreground-muted">YOUR MP4 OR MOV</span>
                    <ArrowRight className="absolute -right-5 top-1/2 z-10 hidden -translate-y-1/2 text-accent-text md:block" size={24} aria-hidden="true" />
                  </li>
                  <li className="relative rounded-lg border border-accent/30 bg-[linear-gradient(180deg,rgba(233,30,99,0.08),rgba(30,30,30,1))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent-text"><ScanSearch size={20} strokeWidth={1.75} /></span>
                      <span className="font-mono text-[10px] text-accent-text">02 / OPTIMIZE</span>
                    </div>
                    <h4 className="mt-4 text-sm font-semibold">We change only what is needed</h4>
                    <p className="mt-1 text-xs leading-5 text-foreground-muted">Already compatible? We remux quickly. Otherwise, we create an H.264 video with AAC audio.</p>
                    <span className="mt-3 inline-flex rounded border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-[9px] text-accent-text">PRESERVE VISUAL QUALITY</span>
                    <ArrowRight className="absolute -right-5 top-1/2 z-10 hidden -translate-y-1/2 text-accent-text md:block" size={24} aria-hidden="true" />
                  </li>
                  <li className="rounded-lg border border-border bg-surface1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-accent-text"><FileCheck size={20} strokeWidth={1.75} /></span>
                      <span className="font-mono text-[10px] text-foreground-muted">03 / READY</span>
                    </div>
                    <h4 className="mt-4 text-sm font-semibold">You download with confidence</h4>
                    <p className="mt-1 text-xs leading-5 text-foreground-muted">Get one compatible MP4 plus a report showing its final size and exactly what changed.</p>
                    <span className="mt-3 inline-flex rounded border border-border px-2 py-1 font-mono text-[9px] text-foreground-muted">READY TO UPLOAD</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          <ul id="features" className="mx-auto mt-6 grid max-w-4xl gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-3 bg-background p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface1 text-accent-text">
                  <benefit.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-semibold tracking-widest text-accent-text">{benefit.marker}</span>
                    <h3 className="text-xs font-semibold">{benefit.title}</h3>
                  </div>
                  <p className="mt-1 text-xs leading-4 text-foreground-muted">{benefit.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-surface1 p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-text">Public beta</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start with the Verified Free plan</h2>
            <p className="mt-2 text-sm text-foreground-muted">3 jobs per day · 100 MB per file · 2 minutes · 1080p60 · no card required</p>
          </div>
          <a href="/signup" className="inline-flex min-h-touch shrink-0 items-center justify-center rounded-md bg-gradient-primary px-6 text-sm font-semibold text-foreground-on-accent transition hover:opacity-90">Get started free</a>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-foreground-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© Bisso Technologies Ltd. Hasheem Studio is in public beta.</span>
          <a href="/status" className="hover:text-foreground">Service status</a>
        </div>
      </footer>
    </div>
  );
}
