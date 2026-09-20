import { useState } from "react";
import { FileVideo, FileCheck, RefreshCw, Pause, Play, UploadCloud } from "lucide-react";
import "./ConversionHero.css";
import { HeroBackdrop } from "./HeroBackdrop";

export function ConversionHero() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="conversion-hero">
      <HeroBackdrop paused={paused} />
      <div className="conversion-hero__stage">
        <div className="conversion-hero__copy">
          <p className="conversion-hero__eyebrow">Hasheem Studio video tools</p>
          <h1>Prepare your video<br className="conversion-hero__title-break" /> for upload</h1>
          <p className="conversion-hero__description">
            Inspect, fix compatibility issues, and create a platform-ready video—with a clear report of exactly what changed.
          </p>
        </div>

        <div className="conversion-scene" data-paused={paused}>
          <div className="conversion-scene__visual" role="img" aria-label="Illustration: prepare a MOV or MP4 video as a compatible MP4 with H.264 video and AAC audio.">
            <div className="conversion-scene__ring conversion-scene__ring--outer" />
            <div className="conversion-scene__ring conversion-scene__ring--inner" />
            <div className="conversion-scene__row" aria-hidden="true">
              <div className="format-tile">
                <div className="format-tile__face format-tile__face--mov"><FileVideo /><strong>MOV</strong></div>
                <div className="format-tile__face format-tile__face--mp4"><FileVideo /><strong>MP4</strong></div>
              </div>
              <div className="conversion-bridge">
                <span className="conversion-bridge__line"><i /></span>
                <div className="conversion-bridge__hub"><RefreshCw /><span /></div>
                <span className="conversion-bridge__line conversion-bridge__line--out"><i /></span>
                <span className="conversion-bridge__label">TO</span>
              </div>
              <div className="format-tile format-tile--output">
                <FileCheck /><strong>MP4</strong><small>H.264 + AAC</small>
              </div>
            </div>
          </div>
          <button type="button" className="conversion-scene__pause" aria-label={paused ? "Play hero animations" : "Pause hero animations"} onClick={() => setPaused(!paused)}>
            {paused ? <Play size={12} /> : <Pause size={12} />}
            <span>{paused ? "Play" : "Pause"} animations</span>
          </button>
        </div>
      </div>

      <div className="hero-upload">
        <span className="hero-upload__badge"><UploadCloud className="hero-upload__icon" size={29} strokeWidth={1.8} aria-hidden="true" /></span>
        <h2>Select your video to prepare</h2>
        <p>or drop an MP4 or MOV file here</p>
        <a href="/signup" className="hero-upload__button"><UploadCloud size={17} aria-hidden="true" />Choose video</a>
        <small>Free plan · 100 MB · 2 minutes · 1080p60</small>
      </div>
    </div>
  );
}
