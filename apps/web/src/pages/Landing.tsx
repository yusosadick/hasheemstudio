import { PlansPanel } from "../components/PlansPanel";
import { ConversionHero } from "../components/ConversionHero";
import { BadgeCheck, Gauge, MonitorSmartphone, ShieldCheck } from "lucide-react";

const steps = [
  { image: "/assets/steps/upload.webp", title: "Upload your video", body: "Add an MP4 or MOV file. Interrupted uploads can resume safely." },
  { image: "/assets/steps/process.webp", title: "Choose what it needs", body: "Pick smaller file, quick repack or re-encode, all as a compatible MP4." },
  { image: "/assets/steps/download.webp", title: "Verify & download", body: "Review what changed, then download the finished file with confidence." },
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
        <div className="landing-content relative mx-auto pb-10 pt-[clamp(12px,2.4vh,24px)] sm:pb-16 sm:pt-5">
          <nav aria-label="Breadcrumb" className="relative z-10 hidden items-center gap-2 text-xs text-foreground-muted sm:flex">
            <a href="/" className="transition-colors hover:text-foreground">Home</a>
            <span aria-hidden="true">›</span><span>Video tools</span><span aria-hidden="true">›</span>
            <span className="text-foreground">Prepare video</span>
          </nav>

          <ConversionHero />

          <div id="how-it-works" className="mx-auto mt-9 max-w-5xl sm:mt-10">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" /><h2 className="text-center text-sm font-semibold sm:text-base">How it works — 3 simple steps</h2><div className="h-px flex-1 bg-border" />
            </div>
            <ol className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="relative rounded-xl border border-border bg-surface1 p-3 text-center last:col-span-2 sm:p-5 md:last:col-span-1">
                  <span className="absolute left-2.5 top-2.5 flex h-6 w-6 sm:left-4 sm:top-4 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-text">{index + 1}</span>
                  <div className="mx-auto flex h-20 items-center justify-center sm:h-28">
                    <img src={step.image} alt="" width="256" height="256" loading="lazy" decoding="async" className="h-20 w-20 select-none object-contain sm:h-28 sm:w-28 drop-shadow-[0_12px_22px_rgba(233,30,99,0.16)]" />
                  </div>
                  <h3 className="mt-1 text-[13px] font-semibold sm:mt-2 sm:text-sm">{step.title}</h3>
                  <p className="mx-auto mt-1 max-w-[16rem] text-[11.5px] leading-4 text-foreground-muted sm:text-xs sm:leading-5">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <ul id="features" className="mx-auto mt-5 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:mt-5 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-2.5 bg-background p-3 sm:gap-3 sm:p-4">
                <span className="hidden h-9 w-9 shrink-0 sm:flex items-center justify-center rounded-md border border-border bg-surface1 text-accent-text">
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
