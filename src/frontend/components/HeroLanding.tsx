import React from "react";
import { useCountUp } from "../hooks/useCountUp";
import type { ViewTab } from "../types";

interface HeroLandingProps {
  onGetStarted: (targetTab?: ViewTab) => void;
}

interface StatMetric {
  glyph: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
  delay: string;
}

const STATS: StatMetric[] = [
  {
    glyph: "<",
    target: 10,
    suffix: "+",
    decimals: 0,
    label: "Pilot Study Users",
    delay: "0.5s",
  },
  {
    glyph: "%",
    target: 256,
    suffix: "-bit",
    decimals: 0,
    label: "AES-GCM Stream E2EE",
    delay: "0.58s",
  },
  {
    glyph: "*",
    target: 24,
    suffix: "/7",
    decimals: 0,
    label: "Real-Time Inference",
    delay: "0.66s",
  },
  {
    glyph: "#",
    target: 6,
    suffix: " Voices",
    decimals: 0,
    label: "Neural TTS Profiles",
    delay: "0.74s",
  },
];

const StatBlock: React.FC<{ metric: StatMetric; index: number }> = ({ metric, index }) => {
  const { ref, display } = useCountUp({
    target: metric.target,
    decimals: metric.decimals,
    suffix: metric.suffix,
    index,
  });

  return (
    <div
      ref={ref}
      className="stat-item anim"
      style={{ "--d": metric.delay } as React.CSSProperties}
    >
      <span className="stat-icon" aria-hidden="true">
        {metric.glyph}
      </span>
      <span className="stat-value">{display}</span>
      <span className="stat-label">{metric.label}</span>
    </div>
  );
};

export const HeroLanding: React.FC<HeroLandingProps> = ({ onGetStarted }) => {
  return (
    <>
      <section className="hero" aria-label="Sign Assist AI Overview">
        {/* Trust / Pilot Row */}
        <div className="trust-row anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
          <div className="trust-avatars" aria-hidden="true">
            <div className="trust-avatar">
              <div className="trust-avatar__inner">
                <i className="fa-solid fa-hands" />
              </div>
            </div>
            <div className="trust-avatar">
              <div className="trust-avatar__inner">
                <i className="fa-solid fa-microphone-lines" />
              </div>
            </div>
            <div className="trust-avatar">
              <div className="trust-avatar__inner">
                <i className="fa-solid fa-shield-halved" />
              </div>
            </div>
          </div>
          <div className="trust-pill">Validated with 10+ User Pilot</div>
        </div>

        {/* Two-line Bubbledot Display Headline */}
        <h1 className="headline">
          <span className="headline__line headline__line--1">Sign Assist AI</span>
          <span className="headline__line headline__line--2">Bridge Every Voice</span>
        </h1>

        {/* Subhead */}
        <p className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
          Translate American Sign Language gestures and reconstruct dysarthric speech in real
          time with end-to-end encrypted multimodal AI.
        </p>

        {/* Primary White Glow CTA */}
        <div className="anim--pulse" style={{ "--d": "0.4s" } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => onGetStarted("speech")}
            className="cta-glow"
            id="hero-get-started-btn"
          >
            <span>Get Started</span>
          </button>
        </div>
      </section>

      {/* Bottom 4-Metric Stats Footer */}
      <footer className="stats-footer" aria-label="Platform Capabilities">
        {STATS.map((metric, idx) => (
          <StatBlock key={metric.label} metric={metric} index={idx} />
        ))}
      </footer>
    </>
  );
};
