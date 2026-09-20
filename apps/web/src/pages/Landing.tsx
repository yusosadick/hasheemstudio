import { IconUploadCloud } from "../components/Icons";

const steps = [
  { image: "/assets/steps/upload.png", title: "Upload your video", body: "Add an MP4 or MOV file. Interrupted uploads can resume safely." },
  { image: "/assets/steps/process.png", title: "Choose what it needs", body: "Inspect it, create a compatible MP4, or re-encode to H.264 and AAC." },
  { image: "/assets/steps/download.png", title: "Verify & download", body: "Review what changed, then download the finished file with confidence." },
];

const benefits = [
  { marker: "01", title: "Private & secure", body: "Your file stays tied to your account." },
  { marker: "02", title: "Fast when possible", body: "Compatible files use a quick remux." },
  { marker: "03", title: "Made for video", body: "MP4 and MOV, up to 1080p60 free." },
  { marker: "04", title: "Honest results", body: "Every transformation is explained." },
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
            <div className="rounded-xl border-2 border-dashed border-border bg-background/60 px-5 py-9 text-center sm:py-11">
              <img
                src="/assets/video-verified-hero.png"
                alt=""
                width="1774"
                height="887"
                className="mx-auto -my-5 w-full max-w-xs select-none object-contain sm:max-w-sm"
              />
              <h2 className="mt-1 text-base font-semibold sm:text-lg">Drop your video here</h2>
              <p className="mt-1 text-sm text-foreground-muted">or choose a file to get started</p>
              <a href="/signup" className="mt-5 inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-gradient-primary px-7 text-sm font-semibold text-foreground-on-accent shadow-lg shadow-accent/10 transition hover:opacity-90">
                <IconUploadCloud width={18} height={18} /> Choose video
              </a>
              <p className="mt-3 text-xs text-foreground-muted">MP4 or MOV · Up to 100 MB and 2 minutes on the free plan</p>
            </div>
          </div>

          <div id="how-it-works" className="mx-auto mt-10 max-w-5xl">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" /><h2 className="text-center text-sm font-semibold sm:text-base">How it works — 3 simple steps</h2><div className="h-px flex-1 bg-border" />
            </div>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="relative rounded-xl border border-border bg-surface1 p-5 text-center">
                  <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-text">{index + 1}</span>
                  <div className="mx-auto flex h-28 items-center justify-center">
                    <img src={step.image} alt="" width="320" height="320" className="h-28 w-28 select-none object-contain drop-shadow-[0_12px_22px_rgba(233,30,99,0.16)]" />
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                  <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-5 text-foreground-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <ul id="features" className="mx-auto mt-5 grid max-w-5xl gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-3 bg-background p-4">
                <span className="font-mono text-[10px] font-semibold tracking-widest text-accent-text">{benefit.marker}</span>
                <div><h3 className="text-xs font-semibold">{benefit.title}</h3><p className="mt-1 text-xs leading-4 text-foreground-muted">{benefit.body}</p></div>
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
