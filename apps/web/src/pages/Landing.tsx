import { PlansPanel } from "../components/PlansPanel";
import { ConversionHero } from "../components/ConversionHero";
import { BadgeCheck, Gauge, MonitorSmartphone, ShieldCheck } from "lucide-react";

const steps = [
  { image: "/assets/steps/upload.png", title: "Upload your video", body: "Add an MP4 or MOV file. Interrupted uploads can resume safely." },
  { image: "/assets/steps/process.png", title: "Choose what it needs", body: "Inspect it, create a compatible MP4, or re-encode to H.264 and AAC." },
  { image: "/assets/steps/download.png", title: "Verify & download", body: "Review what changed, then download the finished file with confidence." },
];

const benefits = [
  { icon: ShieldCheck, marker: "01", title: "Private & secure", body: "Your upload stays private, even before you sign in." },
  { icon: Gauge, marker: "02", title: "Fast when possible", body: "Compatible files use a quick remux." },
  { icon: MonitorSmartphone, marker: "03", title: "Made for video", body: "MP4 and MOV, up to 1080p60 free." },
  { icon: BadgeCheck, marker: "04", title: "Honest results", body: "Every transformation is explained." },
];

export default function Landing() {
  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-border">
        <div className="landing-content relative mx-auto pb-14 pt-5 sm:pb-16">
          <nav aria-label="Breadcrumb" className="relative z-10 flex items-center gap-2 text-xs text-foreground-muted">
            <a href="/" className="transition-colors hover:text-foreground">Home</a>
            <span aria-hidden="true">›</span><span>Video tools</span><span aria-hidden="true">›</span>
            <span className="text-foreground">Prepare video</span>
          </nav>

          <ConversionHero />

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

      <PlansPanel />

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-foreground-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © Hasheem Studio, Developed: Yusuf Sadick (Ig:{" "}
            <a href="https://www.instagram.com/yuso_sadick/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">yuso_sadick</a>
            ){" "}
            <a href="https://yusouf.dev" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">yusouf.dev</a>
          </span>
          <nav aria-label="Legal" className="flex gap-4">
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/terms" className="hover:text-foreground">Terms</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
