import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2, Loader2, ShieldCheck, Smartphone, Sparkles, X, XCircle } from "lucide-react";
import { getSession } from "../lib/auth";
import { createStudioPayment, getEntitlement, getPlans, getStudioPayment, type Entitlement, type PlanCode, type PlanInfo, type PlansCatalogue } from "../lib/api";
import "./PlansPanel.css";

const tsh = (n: number) => `${n.toLocaleString("en-US")} TSh`;
const OPEN = new Set(["created", "pending", "unknown"]);

export function usePlans() {
  const [catalogue, setCatalogue] = useState<PlansCatalogue | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const refresh = useCallback(() => {
    if (getSession()) void getEntitlement().then(setEntitlement).catch(() => setEntitlement(null));
  }, []);
  useEffect(() => {
    let live = true;
    void getPlans().then((c) => { if (live) setCatalogue(c); }).catch(() => { if (live) setCatalogue({ available: false, currency: "TZS", free: { videosPerDay: 1 }, plans: [] }); });
    refresh();
    return () => { live = false; };
  }, [refresh]);
  return { catalogue, entitlement, refresh };
}

/* ── Checkout dialog: details → approve on phone → confirmed. The result only ever comes from the server. ── */
export function CheckoutDialog({ plan, onClose, onPaid }: { plan: PlanInfo; onClose: () => void; onPaid: () => void }) {
  const reduce = useReducedMotion();
  const [payment, setPayment] = useState<{ id: string; status: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => {
    if (!payment || !OPEN.has(payment.status)) return;
    let live = true;
    const timer = setInterval(() => {
      void getStudioPayment(payment.id)
        .then((p) => { if (live) { setPayment({ id: payment.id, status: p.status }); setError(""); if (p.status === "completed") onPaid(); } })
        .catch(() => { if (live) setError("Status is temporarily unavailable. Please don't pay again."); });
    }, 3000);
    return () => { live = false; clearInterval(timer); };
  }, [payment, onPaid]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || payment) return;
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try {
      const p = await createStudioPayment({ planCode: plan.code, method: "mobile", phone: String(f.get("phone")).replace(/\s|^\+/g, ""), firstname: String(f.get("firstname")).trim(), lastname: String(f.get("lastname")).trim() });
      setPayment(p);
    } catch (err) { setError(err instanceof Error ? err.message : "Payment unavailable."); }
    finally { setBusy(false); }
  }

  const status = payment?.status;
  const done = status === "completed";
  const failed = status === "failed" || status === "voided" || status === "expired";
  const waiting = !!payment && !done && !failed;

  return (
    <motion.div className="plans-dialog__scrim" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div role="dialog" aria-modal="true" aria-label={`${plan.name} plan checkout`} className="plans-dialog" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.22 }}>
        <button type="button" className="plans-dialog__close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        <div className="plans-dialog__summary">
          <span className="plans-dialog__chip"><Sparkles size={12} aria-hidden="true" />{plan.name}</span>
          <strong>{tsh(plan.amountTzs)}</strong>
          <span>{plan.videos} videos · {plan.days} days</span>
        </div>

        {done ? (
          <div className="plans-dialog__state" role="status">
            <span className="plans-dialog__badge is-ok"><CheckCircle2 size={30} aria-hidden="true" /></span>
            <h3>{plan.name} plan is active</h3>
            <p>{plan.videos} videos are ready to use for the next {plan.days} days.</p>
            <button type="button" className="plans-cta plans-cta--primary" onClick={onClose}>Continue</button>
          </div>
        ) : failed ? (
          <div className="plans-dialog__state" role="status">
            <span className="plans-dialog__badge is-bad"><XCircle size={30} aria-hidden="true" /></span>
            <h3>Payment {status === "voided" ? "cancelled" : status}</h3>
            <p>You weren't charged and nothing was unlocked. You can try again.</p>
            <button type="button" className="plans-cta plans-cta--primary" onClick={() => { setPayment(null); setError(""); }}>Try again</button>
          </div>
        ) : waiting ? (
          <div className="plans-dialog__state" role="status" aria-live="polite">
            <span className="plans-dialog__badge is-wait"><Smartphone size={28} aria-hidden="true" /><i /></span>
            <h3>{status === "unknown" ? "Checking your payment…" : "Approve on your phone"}</h3>
            <p>{status === "unknown" ? "We're confirming whether it went through. Please don't pay again." : "Enter your mobile money PIN when the prompt appears. This page updates by itself."}</p>
            <span className="plans-dialog__hint"><Loader2 size={14} className="plans-spin" aria-hidden="true" />Waiting for confirmation</span>
          </div>
        ) : (
          <form onSubmit={submit} className="plans-dialog__form">
            <div className="plans-dialog__row">
              <label>First name<input ref={first} required name="firstname" maxLength={80} autoComplete="given-name" /></label>
              <label>Last name<input required name="lastname" maxLength={80} autoComplete="family-name" /></label>
            </div>
            <label>Mobile money number
              <input required name="phone" inputMode="numeric" autoComplete="tel" placeholder="255 7XX XXX XXX" pattern="\+?255\s?[67][0-9]{2}\s?[0-9]{3}\s?[0-9]{3}" title="Format: 255 followed by 9 digits, e.g. 255712345678" />
            </label>
            <button type="submit" className="plans-cta plans-cta--primary" disabled={busy}>
              {busy ? <><Loader2 size={16} className="plans-spin" aria-hidden="true" />Starting…</> : <>Pay {tsh(plan.amountTzs)}</>}
            </button>
            <p className="plans-dialog__fine"><ShieldCheck size={13} aria-hidden="true" />Secure mobile money payment via Snippe. One-time — no subscription, no auto-renewal.</p>
          </form>
        )}
        {error && <p role="alert" className="plans-dialog__error">{error}</p>}
      </motion.div>
    </motion.div>
  );
}

function BalanceBanner({ e }: { e: Entitlement }) {
  if (e.paid) {
    const pct = Math.max(4, Math.round((e.paid.videosRemaining / e.paid.videosTotal) * 100));
    return (
      <div className="plans-balance" role="status">
        <div><Sparkles size={15} aria-hidden="true" /><strong>{e.paid.videosRemaining} of {e.paid.videosTotal} videos left</strong><span>until {new Date(e.paid.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></div>
        <i style={{ ["--w" as string]: `${pct}%` }} />
      </div>
    );
  }
  return null;
}

/* ── Pricing section (landing) ────────────────────────────────────────────────────────────────────────── */
export function PlansPanel() {
  const { catalogue, entitlement, refresh } = usePlans();
  const [checkout, setCheckout] = useState<PlanInfo | null>(null);
  const signedIn = Boolean(getSession());
  const live = catalogue?.available === true;
  const plans = catalogue?.plans ?? [];

  const pick = (p: PlanInfo) => { if (live && signedIn) setCheckout(p); };
  const cta = (p: PlanInfo, primary: boolean) => {
    const label = `Get ${p.name}`;
    if (!live) return <button type="button" className="plans-cta" disabled>Opening soon</button>;
    if (!signedIn) return <Link className={`plans-cta${primary ? " plans-cta--primary" : ""}`} to={`/signup?next=${encodeURIComponent("/#pricing")}`}>{label}</Link>;
    return <button type="button" className={`plans-cta${primary ? " plans-cta--primary" : ""}`} onClick={() => pick(p)}>{label}</button>;
  };

  return (
    <section id="pricing" className="plans" aria-labelledby="plans-title">
      <div className="plans__head">
        <p className="plans__eyebrow">Pricing</p>
        <h2 id="plans-title">Start free. Upgrade when you need more.</h2>
        <p>Pay with mobile money — no card, no subscription, no auto-renewal.</p>
      </div>

      {entitlement && <BalanceBanner e={entitlement} />}

      <div className="plans__grid">
        <article className="plan-card">
          <h3>Free</h3>
          <p className="plan-card__price"><strong>0</strong><span>TSh</span></p>
          <p className="plan-card__quota"><b>1</b> video a day</p>
          <ul>
            <li><Check size={14} aria-hidden="true" />Up to 100 MB · 2 min · 1080p60</li>
            <li><Check size={14} aria-hidden="true" />Verified, social-ready MP4</li>
            <li><Check size={14} aria-hidden="true" />No card needed</li>
          </ul>
          {signedIn ? <span className="plans-cta plans-cta--ghost">{entitlement?.paid ? "Included with every plan" : "Your current plan"}</span> : <Link className="plans-cta" to="/signup">Start free</Link>}
        </article>

        {plans.map((p) => {
          const featured = p.code === "monthly";
          return (
            <article key={p.code} className={`plan-card${featured ? " plan-card--featured" : ""}`}>
              {featured && <span className="plan-card__badge"><Sparkles size={11} aria-hidden="true" />Most popular</span>}
              <h3>{p.name}</h3>
              <p className="plan-card__price"><strong>{p.amountTzs.toLocaleString("en-US")}</strong><span>TSh</span></p>
              <p className="plan-card__quota"><b>{p.videos}</b> videos <em>· {p.days} days</em></p>
              <ul>
                <li><Check size={14} aria-hidden="true" />{Math.round(p.amountTzs / p.videos)} TSh per video</li>
                <li><Check size={14} aria-hidden="true" />Plus your free daily video</li>
                <li><Check size={14} aria-hidden="true" />{p.code === "monthly" ? "A full month, one payment" : "Perfect for a project week"}</li>
              </ul>
              {cta(p, featured)}
            </article>
          );
        })}
      </div>
      {!live && catalogue && <p className="plans__note">Paid plans open very soon — the free plan is available now.</p>}

      <AnimatePresence>{checkout && <CheckoutDialog plan={checkout} onClose={() => setCheckout(null)} onPaid={refresh} />}</AnimatePresence>
    </section>
  );
}

/* ── Compact upgrade prompt shown right where a download was blocked ─────────────────────────────────── */
export function UpgradeInline({ onPaid }: { onPaid?: () => void }) {
  const { catalogue, refresh } = usePlans();
  const [checkout, setCheckout] = useState<PlanCode | null>(null);
  const live = catalogue?.available === true;
  const plan = catalogue?.plans.find((p) => p.code === checkout) ?? null;
  return (
    <div className="plans-inline">
      <p className="plans-inline__title">Keep going with a plan</p>
      {catalogue && catalogue.plans.length > 0 && (
        <div className="plans-inline__grid">
          {catalogue.plans.map((p) => (
            <button key={p.code} type="button" disabled={!live} className={`plans-inline__opt${p.code === "monthly" ? " is-featured" : ""}`} onClick={() => setCheckout(p.code)}>
              <strong>{p.name}</strong><span>{p.videos} videos · {p.days} days</span><b>{tsh(p.amountTzs)}</b>
            </button>
          ))}
        </div>
      )}
      {!live && <p className="plans-inline__note">Paid plans open very soon. Your free video returns after midnight UTC.</p>}
      <AnimatePresence>{plan && <CheckoutDialog plan={plan} onClose={() => setCheckout(null)} onPaid={() => { refresh(); onPaid?.(); }} />}</AnimatePresence>
    </div>
  );
}
