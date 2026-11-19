import swMonogram from "../assets/spendwise-monogram.svg";
import { useEffect, useState } from "react";

export default function BrandIntro({ onComplete }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    const timer = window.setTimeout(() => {
      setLeaving(true);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    if (!leaving) return;

    const timer = window.setTimeout(onComplete, 550);
    return () => window.clearTimeout(timer);
  }, [leaving, onComplete]);

  return (
    <div className={`brand-intro ${leaving ? "intro-leaving" : ""}`}>
      <button
        className="intro-skip"
        onClick={onComplete}
        type="button"
      >
        Skip intro ↗
      </button>

      <div className="intro-center">
        <img
            src={swMonogram}
            className="intro-brand-logo"
             alt="SpendWise SW monogram"
        />
        <div className="intro-line" />
        <p>THE ART OF KNOWING YOUR MONEY</p>
      </div>

      <span className="intro-index">SW</span>
      <span className="intro-edition">PERSONAL FINANCE, REIMAGINED.</span>
    </div>
  );
}
