import swMonogramDark from "../assets/spendwise-monogram-dark.svg";
import swWordmark from "../assets/spendwise-wordmark.svg";
import swWordmarkDark from "../assets/spendwise-wordmark-dark.svg";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight as IncomeArrow,
  Menu,
  X,
  MoveDown,
  ShieldCheck,
  ChartNoAxesCombined,
  Target,
  Repeat2,
  Wallet,
  Sparkles
} from "lucide-react";

import BrandIntro from "../components/BrandIntro";
import "../Landing.css";

const features = [
  {
    number: "01",
    title: "Every rupee. Accounted for.",
    description:
      "Record income and expenses in a space designed to make everyday money management effortless.",
    icon: Wallet,
  },
  {
    number: "02",
    title: "Spend with intention.",
    description:
      "Create monthly budgets, understand your spending patterns and see what matters.",
    icon: ChartNoAxesCombined,
  },
  {
    number: "03",
    title: "Make room for bigger things.",
    description:
      "Set savings goals and follow your progress, one contribution at a time.",
    icon: Target,
  },
  {
    number: "04",
    title: "Stay a step ahead.",
    description:
      "Keep track of recurring payments, upcoming expenses and money owed.",
    icon: Repeat2,
  },
];

function Wordmark({ light = false }) {
  return (
    <img
      src={light ? swWordmark : swWordmarkDark}
      alt="SpendWise"
      className={`brand-wordmark-image ${light ? "brand-wordmark-light" : ""}`}
    />
  );
}

function ProductPreview() {
  return (
    <div className="landing-product-preview">
      <div className="preview-top">
        <span className="preview-logo">SW / SPENDWISE</span>
        <span className="preview-period">YOUR FINANCIAL OVERVIEW</span>
      </div>

      <div className="preview-heading">
        <div>
          <span className="preview-kicker">THE BIG PICTURE</span>
          <h3>Money, in perspective.</h3>
        </div>
        <span className="preview-month">NOVEMBER 2026</span>
      </div>

      <div className="preview-cards">
        <div className="preview-card preview-card-primary">
          <span>NET CASH FLOW</span>
          <strong>₹24,580</strong>
          <small>Know where you stand.</small>
        </div>
        <div className="preview-card">
          <span>INCOME</span>
          <strong>₹42,000</strong>
          <small><ArrowDownLeft size={13} /> Money coming in</small>
        </div>
        <div className="preview-card">
          <span>EXPENSES</span>
          <strong>₹17,420</strong>
          <small><IncomeArrow size={13} /> Money going out</small>
        </div>
      </div>

      <div className="preview-bottom">
        <div className="preview-chart">
          <div className="preview-chart-title">
            <strong>Spending rhythm</strong>
            <span>MONTHLY ACTIVITY</span>
          </div>
          <div className="preview-bars" aria-hidden="true">
            {[38, 57, 45, 78, 62, 92, 54, 74, 48, 85, 67, 96].map(
              (height, index) => (
                <div
                  key={index}
                  className={`preview-bar ${index === 11 ? "highlight" : ""}`}
                  style={{ height: `${height}%` }}
                />
              )
            )}
          </div>
          <div className="preview-axis"><span>JAN</span><span>DEC</span></div>
        </div>
        <div className="preview-note">
          <span>THE DETAILS MATTER.</span>
          <strong>Clarity looks good on you.</strong>
          <div className="preview-orbit"><Sparkles size={35} /></div>
        </div>
      </div>
      <div className="preview-disclaimer">
        Illustrative product preview · Sample figures, not your actual data
      </div>
    </div>
  );
}

export default function Landing() {
  const [showIntro, setShowIntro] = useState(
    () => !sessionStorage.getItem("spendwise-intro-seen")
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const finishIntro = useCallback(() => {
    sessionStorage.setItem("spendwise-intro-seen", "true");
    setShowIntro(false);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [showIntro]);

  return (
    <div className="landing-site">
      {showIntro && <BrandIntro onComplete={finishIntro} />}

      <header className="landing-header">
        <Link to="/" className="landing-logo" aria-label="SpendWise home">
          <img
            src={swMonogramDark}
            className="brand-header-monogram"
            alt=""
          />
          <Wordmark />
        </Link>

        <nav className={`landing-nav ${menuOpen ? "nav-open" : ""}`}>
          <a href="#philosophy" onClick={() => setMenuOpen(false)}>
            Our philosophy
          </a>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <a href="#experience" onClick={() => setMenuOpen(false)}>
            The experience
          </a>
          <Link
            to="/dashboard"
            className="landing-nav-cta"
            onClick={() => setMenuOpen(false)}
          >
            Enter SpendWise <ArrowUpRight size={16} />
          </Link>
        </nav>

        <button
          className="landing-menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-meta">
            <span>PERSONAL FINANCE / ANOTHER PERSPECTIVE</span>
            <span>EST. 2026 — BUILT FOR YOU</span>
          </div>

          <div className="hero-copy">
            <p className="hero-overline">
              A LITTLE MORE CONTROL. A LOT MORE FREEDOM.
            </p>
            <h1>
              Money has
              <br />
              <em>never looked</em>
              <br />
              this good<span className="hero-stop">.</span>
            </h1>
            <div className="hero-bottom">
              <p>
                Less financial guesswork.
                <br />
                More living on your terms.
              </p>
              <Link to="/dashboard" className="landing-pill-button">
                Get started <ArrowUpRight size={20} />
              </Link>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-ring ring-one" />
            <div className="art-ring ring-two" />
            <div className="art-orb" />
            <div className="art-ribbon ribbon-one" />
            <div className="art-ribbon ribbon-two" />
            <span className="art-label">THE FUTURE IS YOURS.</span>
          </div>

          <div className="hero-foot">
            <span>INDEPENDENCE STARTS WITH A LITTLE CLARITY.</span>
            <a href="#philosophy">
              SCROLL TO EXPLORE <MoveDown size={16} />
            </a>
          </div>
        </section>

        <section id="philosophy" className="landing-philosophy">
          <div className="section-topline">
            <span>01 / THE PHILOSOPHY</span>
            <span>MORE THAN A TRACKER</span>
          </div>

          <div className="philosophy-layout">
            <h2>
              Your money.
              <br />
              <em>Your rules.</em>
            </h2>
            <div className="philosophy-aside">
              <span className="small-star">✳</span>
              <p>
                Money isn't just numbers on a screen. It's your independence,
                your plans, your next big thing.
              </p>
              <p>
                SpendWise brings the little details together, so you can focus
                on the bigger picture.
              </p>
              <a href="#features" className="landing-inline-link">
                DISCOVER WHAT'S INSIDE <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </section>

        <section id="experience" className="landing-showcase">
          <div className="section-topline">
            <span>02 / THE EXPERIENCE</span>
            <span>DESIGNED FOR CLARITY</span>
          </div>
          <div className="showcase-heading">
            <h2>Consider this your{" "} 
                <em>money era.</em></h2>
            <p>A personal finance space that feels as considered as everything else in your life.</p>
          </div>
          <ProductPreview />
        </section>

        <section id="features" className="landing-features">
          <div className="section-topline">
            <span>03 / THE ESSENTIALS</span>
            <span>THE TOOLS YOU NEED</span>
          </div>
          <div className="features-heading">
            <h2>Good habits.<br /><em>Great energy.</em></h2>
            <p>Everything you need to get closer to your financial goals.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ number, title, description, icon: Icon }) => (
              <article className="feature-item" key={number}>
                <div className="feature-item-top">
                  <span>{number} / 04</span>
                  <Icon size={27} strokeWidth={1.35} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <ArrowUpRight className="feature-arrow" size={19} />
              </article>
            ))}
          </div>
          <p className="features-footnote">
            Some features are being developed. The core transaction tracker is
            available in the local preview.
          </p>
        </section>

        <section className="landing-manifesto">
          <div className="manifesto-top">
            <span>THE SPENDWISE MANIFESTO</span>
            <ShieldCheck size={24} strokeWidth={1.3} />
          </div>
          <h2>
            Be ambitious.
            <br />
            Be intentional.
            <br />
            <em>Be in control.</em>
          </h2>
          <div className="manifesto-bottom">
            <p>Make your money make sense.</p>
            <Link to="/dashboard" className="manifesto-cta">
              Enter your money era <ArrowUpRight size={20} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-main">
          <Wordmark />
          <p>PERSONAL FINANCE, WITH PERSONALITY.</p>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SPENDWISE</span>
          <span>MADE TO MAKE MONEY MAKE SENSE.</span>
          <a href="#">BACK TO TOP ↑</a>
        </div>
      </footer>
    </div>
  );
}
