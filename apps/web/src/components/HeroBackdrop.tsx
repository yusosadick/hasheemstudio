import { useEffect, useRef } from "react";

/** Decorative character waves. Stops when paused, offscreen, or the tab is hidden. */
export function HeroBackdrop({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let inView = true;

    function draw() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.font = "10px ui-monospace, monospace";
      const phase = phaseRef.current;
      for (let y = 8; y < height; y += 15) {
        for (let x = 0; x < width; x += 12) {
          const bend = Math.sin(x * 0.005 + phase * 0.3) * 75;
          const ribbon = Math.sin((y - x * 0.38 + bend) * 0.029 - phase * 0.45);
          const grain = (Math.sin(x * 1.73 + y * 0.67) + 1) / 2;
          if (ribbon < 0.38 || grain < 0.22) continue;
          const alpha = (ribbon - 0.38) * 0.19;
          context.fillStyle = grain > 0.96
            ? `rgba(255,107,53,${alpha * 0.8})`
            : `rgba(190,190,198,${alpha})`;
          context.fillText(grain > 0.58 ? "1" : "0", x, y);
        }
      }
    }

    function tick(now: number) {
      if (now - last >= 60) {
        phaseRef.current += last ? Math.min((now - last) / 1000, 0.1) : 0;
        last = now;
        draw();
      }
      frame = window.requestAnimationFrame(tick);
    }

    function sync() {
      window.cancelAnimationFrame(frame);
      last = 0;
      draw();
      if (!paused && !reducedMotion.matches && !document.hidden && inView) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    const resize = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      sync();
    });
    const visibility = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    resize.observe(canvas);
    visibility.observe(canvas);
    reducedMotion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      window.cancelAnimationFrame(frame);
      resize.disconnect();
      visibility.disconnect();
      reducedMotion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);

  return <canvas ref={canvasRef} className="hero-backdrop" aria-hidden="true" />;
}
