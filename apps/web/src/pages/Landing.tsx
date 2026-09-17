import { IconGauge, IconShield, IconFilm } from "../components/Icons";

const features = [
  {
    icon: IconFilm,
    title: "See what your file actually is",
    body: "Duration, codec, frame rate, VFR/CFR, rotation and colour metadata — inspected server-side, not guessed from the browser.",
  },
  {
    icon: IconShield,
    title: "Know what changed, and what didn't",
    body: "Remux and re-encode are shown separately. We never imply a compatibility pass added detail your source didn't have.",
  },
  {
    icon: IconGauge,
    title: "Fast paths when you don't need a full encode",
    body: "Files that are already compatible get a quick remux instead of a slow, unnecessary re-encode.",
  },
];

export default function Landing() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-border bg-surface1 px-3 py-1 text-xs font-medium text-foreground-muted">
            Public beta — hard limits apply, see pricing
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Your video&apos;s{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              best upload
            </span>{" "}
            starts here.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-foreground-muted">
            Inspect a video, understand what needs changing, create a platform-appropriate
            output, and verify what changed before you publish.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex min-h-touch w-full items-center justify-center rounded-md bg-gradient-primary px-6 text-base font-medium text-foreground-on-accent shadow-sm transition-opacity hover:opacity-90 sm:w-auto"
            >
              Start for free
            </a>
            <a
              href="/tools/video-inspector"
              className="inline-flex min-h-touch w-full items-center justify-center rounded-md border border-border px-6 text-base font-medium text-foreground transition-colors hover:bg-surface1 sm:w-auto"
            >
              Try the inspector
            </a>
          </div>
          <p className="mt-4 text-xs text-foreground-muted">
            Verified Free plan: 100&nbsp;MB/file, 2 minutes, 1080p60, 3 jobs/day. No card required.
          </p>
        </div>
      </section>

      <section id="features" className="border-t border-border bg-surface1/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Built on one principle: explain every transformation
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-surface1 p-6 sm:p-8"
              >
                <f.icon className="text-accent" />
                <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {["Upload", "Inspect", "Choose a recipe", "Verify & download"].map((step, i) => (
            <li key={step} className="rounded-lg border border-border p-5">
              <span className="text-sm font-medium text-accent-text">Step {i + 1}</span>
              <p className="mt-1 font-medium">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/prototypes/upload"
            className="text-sm font-medium text-accent-text underline underline-offset-4"
          >
            View upload wizard prototype →
          </a>
          <a
            href="/prototypes/job-result"
            className="text-sm font-medium text-accent-text underline underline-offset-4"
          >
            View job result prototype →
          </a>
        </div>
      </section>

      <section id="pricing" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Beta limits, not final pricing
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            These are configurable hypotheses for the beta, metered per job — not a committed
            price list. Checkout is disabled until a payment processor is approved and tested.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { name: "Verified Free", detail: "100 MB/file · 2 min · 1080p60 · 3 jobs/day" },
              { name: "Pro Beta", detail: "500 MB/file · 10 min · select 4K recipes · 2 concurrent jobs" },
              { name: "Agency", detail: "Negotiated storage/compute/bandwidth · team membership" },
            ].map((p) => (
              <div key={p.name} className="rounded-lg border border-border p-6">
                <h3 className="font-medium">{p.name}</h3>
                <p className="mt-2 text-sm text-foreground-muted">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-foreground-muted sm:px-6">
          © Bisso Technologies Ltd. Hasheem Studio is in public beta — see{" "}
          <a href="/status" className="underline underline-offset-4">
            status
          </a>{" "}
          for current limitations.
        </div>
      </footer>
    </div>
  );
}
