import { useState, useEffect } from "react";

const FONTS_CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap');`;

const light = {
  bgPrimary: "#F7F6F3", bgSecondary: "#EEEDEA", bgSurface: "#FFFFFF",
  bgSurfaceHover: "#F2F1EE", bgInset: "#E8E7E3",
  inkPrimary: "#0E0E11", inkSecondary: "#5C5C66", inkTertiary: "#9C9CA5",
  inkFaint: "#C5C5BF", inkInverse: "#F7F6F3",
  ruleDefault: "#DDDDD8", ruleSubtle: "#EEEEEA", ruleStrong: "#C5C5BF",
  dotGrid: "#D4D4CE",
  emPrimary: "#0E0E11", emHover: "#2A2A2F", emGlow: "rgba(14,14,17,0.06)",
  statusNeg: "#C13438", statusCau: "#B8860B",
};

const dark = {
  bgPrimary: "#0A0A0C", bgSecondary: "#111113", bgSurface: "#18181B",
  bgSurfaceHover: "#1F1F23", bgInset: "#0F0F11",
  inkPrimary: "#EDEDF0", inkSecondary: "#8A8A94", inkTertiary: "#5C5C66",
  inkFaint: "#3A3A40", inkInverse: "#0A0A0C",
  ruleDefault: "#27272B", ruleSubtle: "#1E1E22", ruleStrong: "#3A3A40",
  dotGrid: "#1E1E22",
  emPrimary: "#EDEDF0", emHover: "#D0D0D6", emGlow: "rgba(237,237,240,0.06)",
  statusNeg: "#E8585C", statusCau: "#E0A020",
};

const DotGrid = ({ t, opacity = 0.5 }) => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `radial-gradient(circle, ${t.dotGrid} 1px, transparent 1px)`,
    backgroundSize: "16px 16px", opacity,
  }} />
);

const Section = ({ title, sub, t, children }) => (
  <div style={{ marginTop: 48 }}>
    <h2 style={{
      fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em",
      color: t.inkPrimary, margin: 0, lineHeight: 1.2,
    }}>{title}</h2>
    {sub && <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: t.inkTertiary, margin: "6px 0 0" }}>{sub}</p>}
    <div style={{ height: 1, background: t.ruleDefault, margin: "14px 0 20px" }} />
    {children}
  </div>
);

const Swatch = ({ color, name, hex, t, border }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 6, background: color, flexShrink: 0,
      border: border ? `1px solid ${t.ruleDefault}` : "none",
    }} />
    <div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: t.inkPrimary }}>{name}</div>
      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: t.inkTertiary }}>{hex}</div>
    </div>
  </div>
);

/* ---- Earnings Counter: the signature component. Pure monochrome. ---- */
const EarningsCounter = ({ t }) => {
  const [val, setVal] = useState(14.72);
  const [flash, setFlash] = useState(false);
  const [showDelta, setShowDelta] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setVal(p => Math.round((p + 0.03) * 100) / 100);
      setFlash(true); setShowDelta(true);
      setTimeout(() => setFlash(false), 500);
      setTimeout(() => setShowDelta(false), 2200);
    }, 3800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary,
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
      }}>Balance</div>
      <div style={{
        fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 40, color: t.inkPrimary,
        lineHeight: 1, fontVariantNumeric: "tabular-nums",
        transition: "text-shadow 400ms ease",
        textShadow: flash ? `0 0 30px ${t.emGlow.replace(/[\d.]+\)$/, "0.4)")}` : "none",
      }}>
        ${val.toFixed(2)}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono'", fontSize: 11, color: t.inkTertiary, marginTop: 4,
        letterSpacing: "0.04em",
      }}>USDC</div>
      <div style={{
        position: "absolute", right: -56, top: 24,
        fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 14, color: t.inkPrimary,
        opacity: showDelta ? 1 : 0,
        transform: showDelta ? "translateY(0)" : "translateY(6px)",
        transition: showDelta
          ? "opacity 200ms ease-out, transform 200ms ease-out"
          : "opacity 120ms ease-in, transform 120ms ease-in",
      }}>
        +$0.03
      </div>
    </div>
  );
};

/* ---- Terminal TV: always dark, 0px radius ---- */
const TerminalTV = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setProgress(p => p >= 100 ? 0 : p + 1), 90);
    return () => clearInterval(iv);
  }, []);
  const filled = Math.floor(progress / 5);
  const bar = "\u2593".repeat(filled) + "\u2591".repeat(20 - filled);

  return (
    <div style={{
      background: "#0E0E11", border: "1px solid #2A2A2E", borderRadius: 0,
      fontFamily: "'JetBrains Mono'", fontSize: 13, color: "#EDEDF0", overflow: "hidden",
    }}>
      <div style={{
        borderBottom: "1px solid #2A2A2E", padding: "8px 14px",
        display: "flex", justifyContent: "space-between", fontSize: 11,
        color: "#5C5C66", letterSpacing: "0.04em",
      }}>
        <span>DEV DRIP TV</span>
        <span style={{ color: "#EDEDF0", fontWeight: 700 }}>$0.02</span>
      </div>
      <div style={{ padding: "14px 14px 10px" }}>
        <div style={{ color: "#EDEDF0", fontWeight: 700, marginBottom: 6 }}>Neon Database</div>
        <div style={{ color: "#8A8A94", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
          Serverless Postgres that scales to zero.
          <br />Cut your DB bill by 80%.
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
          {["[D]iscover", "[S]kip", "[M]ute"].map((a, i) => (
            <span key={i} style={{
              padding: "3px 8px", border: `1px solid ${i === 0 ? "#5C5C66" : "#2A2A2E"}`,
              color: i === 0 ? "#EDEDF0" : "#5C5C66", cursor: "pointer",
            }}>{a}</span>
          ))}
        </div>
      </div>
      <div style={{
        borderTop: "1px solid #2A2A2E", padding: "8px 14px", fontSize: 11,
        color: "#3A3A40", display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ letterSpacing: 1 }}>{bar}</span>
        <span style={{ color: "#5C5C66" }}>{progress}%</span>
      </div>
    </div>
  );
};

/* ---- Digest Card: between-sessions morning format ---- */
const DigestCard = ({ t }) => (
  <div style={{
    background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8,
    padding: 20, position: "relative", overflow: "hidden",
  }}>
    <DotGrid t={t} opacity={0.15} />
    <div style={{ position: "relative" }}>
      <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 13, color: t.inkPrimary, marginBottom: 12 }}>
        Good Morning
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: t.inkTertiary }}>Yesterday</span>
        <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 16, color: t.inkPrimary }}>+$1.24</span>
      </div>
      <div style={{ height: 1, background: t.ruleSubtle, margin: "0 0 12px" }} />
      {[
        { tag: "INFRA", title: "Turso launched edge replication", sponsor: "Turso" },
        { tag: "TIP", title: "git worktree lets you checkout multiple branches", sponsor: "GitKraken" },
        { tag: "ROLE", title: "Staff Engineer @ Stripe (Remote)", sponsor: "Stripe" },
      ].map((item, i) => (
        <div key={i} style={{
          padding: "8px 0",
          borderBottom: i < 2 ? `1px solid ${t.ruleSubtle}` : "none",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{
            fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
            background: t.bgInset, color: t.inkTertiary, padding: "2px 5px", borderRadius: 3,
            flexShrink: 0, marginTop: 2,
          }}>{item.tag}</span>
          <div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: t.inkPrimary, lineHeight: 1.3 }}>{item.title}</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: t.inkTertiary, marginTop: 2 }}>Sponsored by {item.sponsor}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {["Dismiss", "Show fewer", "Customize"].map((a, i) => (
          <span key={i} style={{
            fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 500,
            color: i === 0 ? t.inkPrimary : t.inkTertiary,
            cursor: "pointer", borderBottom: `1px solid ${i === 0 ? t.ruleStrong : "transparent"}`,
            paddingBottom: 1,
          }}>{a}</span>
        ))}
      </div>
    </div>
  </div>
);

export default function DesignSystem() {
  const [isDark, setIsDark] = useState(false);
  const t = isDark ? dark : light;

  return (
    <>
      <style>{FONTS_CSS}{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes dotPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.55; } }
      `}</style>
      <div style={{
        background: t.bgPrimary, color: t.inkPrimary, minHeight: "100vh",
        fontFamily: "'DM Sans', sans-serif", transition: "background 250ms, color 250ms",
      }}>

        {/* ======== HERO ======== */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          <DotGrid t={t} opacity={0.3} />
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 48px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 5, background: t.inkPrimary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 6, height: 10, borderRadius: "0 0 3px 3px", background: t.inkInverse, opacity: 0.9 }} />
                </div>
                <span style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
                  dev drip
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 500, letterSpacing: "0.06em",
                  border: `1px solid ${t.ruleDefault}`, color: t.inkTertiary, padding: "2px 6px", borderRadius: 3,
                }}>v1.1</span>
              </div>
              <button onClick={() => setIsDark(!isDark)} style={{
                background: "transparent", border: `1px solid ${t.ruleDefault}`,
                borderRadius: 8, padding: "7px 14px", cursor: "pointer",
                fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: t.inkSecondary,
              }}>
                {isDark ? "Light" : "Dark"}
              </button>
            </div>

            <h1 style={{
              fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 44,
              letterSpacing: "-0.03em", lineHeight: 1.06, margin: 0, maxWidth: 560,
            }}>
              Industrial Paper
            </h1>
            <p style={{
              fontFamily: "'DM Sans'", fontSize: 15, lineHeight: 1.55, color: t.inkSecondary,
              marginTop: 14, maxWidth: 480,
            }}>
              A monochrome design language for developers who earn while they wait. Precision through typography, not color.
            </p>

            {/* Hero data strip */}
            <div style={{
              display: "flex", gap: 32, marginTop: 28, paddingTop: 20,
              borderTop: `1px solid ${t.ruleDefault}`,
            }}>
              {[
                { label: "THIS MONTH", value: "$14.72" },
                { label: "IMPRESSIONS", value: "2,725" },
                { label: "AVG eCPM", value: "$15.40" },
                { label: "SURFACES", value: "5 active" },
              ].map((d, i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 4 }}>{d.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 18, color: t.inkPrimary, fontVariantNumeric: "tabular-nums" }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>

          {/* ======== COLORS ======== */}
          <Section t={t} title="Color System" sub="Pure monochrome with warm undertones. Status color is rare and tiny — like Nothing's red dot.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 10 }}>PAPER</div>
                <Swatch t={t} color={t.bgPrimary} name="Primary" hex={t.bgPrimary} border />
                <Swatch t={t} color={t.bgSecondary} name="Secondary" hex={t.bgSecondary} border />
                <Swatch t={t} color={t.bgSurface} name="Surface" hex={t.bgSurface} border />
                <Swatch t={t} color={t.bgInset} name="Inset" hex={t.bgInset} border />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 10 }}>INK</div>
                <Swatch t={t} color={t.inkPrimary} name="Primary" hex={t.inkPrimary} />
                <Swatch t={t} color={t.inkSecondary} name="Secondary" hex={t.inkSecondary} />
                <Swatch t={t} color={t.inkTertiary} name="Tertiary" hex={t.inkTertiary} />
                <Swatch t={t} color={t.inkFaint} name="Faint" hex={t.inkFaint} />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 10 }}>STRUCTURE</div>
                <Swatch t={t} color={t.ruleDefault} name="Rule Default" hex={t.ruleDefault} border />
                <Swatch t={t} color={t.ruleSubtle} name="Rule Subtle" hex={t.ruleSubtle} border />
                <Swatch t={t} color={t.ruleStrong} name="Rule Strong" hex={t.ruleStrong} border />
                <Swatch t={t} color={t.dotGrid} name="Dot Grid" hex={t.dotGrid} border />
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 10 }}>STATUS</div>
                <Swatch t={t} color={t.statusNeg} name="Negative" hex={t.statusNeg} />
                <Swatch t={t} color={t.statusCau} name="Caution" hex={t.statusCau} />
                <div style={{ marginTop: 10, fontFamily: "'DM Sans'", fontSize: 11, color: t.inkTertiary, lineHeight: 1.5, maxWidth: 160 }}>
                  Used like Nothing's red dot — tiny, functional, extremely rare.
                </div>
              </div>
            </div>
          </Section>

          {/* ======== TYPOGRAPHY ======== */}
          <Section t={t} title="Typography" sub="Space Mono for headlines. DM Sans for body. JetBrains Mono for money.">
            <div style={{ background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 12, padding: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 500, color: t.inkTertiary, letterSpacing: "0.1em", marginBottom: 8 }}>DISPLAY / SPACE MONO</div>
                <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 36, letterSpacing: "-0.03em", lineHeight: 1.1, color: t.inkPrimary }}>
                  Earn while you wait
                </div>
                <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", lineHeight: 1.2, color: t.inkPrimary, marginTop: 8 }}>
                  Section heading
                </div>
                <div style={{ fontFamily: "'Space Mono'", fontWeight: 400, fontSize: 14, color: t.inkSecondary, marginTop: 6 }}>
                  Space Mono regular — technical labels
                </div>
              </div>
              <div style={{ height: 1, background: t.ruleSubtle, margin: "0 0 24px" }} />
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 500, color: t.inkTertiary, letterSpacing: "0.1em", marginBottom: 8 }}>BODY / DM SANS</div>
                <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 18, color: t.inkPrimary }}>Card Title in DM Sans Semibold</div>
                <div style={{ fontFamily: "'DM Sans'", fontWeight: 400, fontSize: 15, lineHeight: 1.6, color: t.inkSecondary, marginTop: 6, maxWidth: 520 }}>
                  Body text in DM Sans Regular. Developers opt in to see relevant content during agent idle windows and earn USDC micropayments that offset their AI tool subscriptions.
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontWeight: 500, fontSize: 13, color: t.inkTertiary, marginTop: 6 }}>Caption / DM Sans Medium 13px</div>
              </div>
              <div style={{ height: 1, background: t.ruleSubtle, margin: "0 0 24px" }} />
              <div>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 500, color: t.inkTertiary, letterSpacing: "0.1em", marginBottom: 8 }}>DATA / JETBRAINS MONO — THE MONEY SIGNAL</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "baseline" }}>
                  {[
                    { val: "$1,247.00", size: 32, w: 700, label: "Data L / Bold", c: t.inkPrimary },
                    { val: "+$14.72", size: 20, w: 600, label: "Data M / SemiBold", c: t.inkPrimary },
                    { val: "$10.50 CPM", size: 14, w: 400, label: "Data S / Regular", c: t.inkSecondary },
                    { val: "0xA1b2...F9e3", size: 12, w: 400, label: "Micro", c: t.inkTertiary },
                  ].map((d, i) => (
                    <div key={i}>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontWeight: d.w, fontSize: d.size, color: d.c, fontVariantNumeric: "tabular-nums" }}>{d.val}</div>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: t.inkTertiary, marginTop: 3 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ======== BUTTONS ======== */}
          <Section t={t} title="Buttons" sub="Maximum contrast. No colored buttons anywhere. Stripe approach.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button style={{ background: t.emPrimary, color: t.inkInverse, border: "none", borderRadius: 8, padding: "10px 22px", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Get Started</button>
              <button style={{ background: t.emPrimary, color: t.inkInverse, border: "none", borderRadius: 8, padding: "10px 22px", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Withdraw $14.72</button>
              <button style={{ background: "transparent", color: t.inkPrimary, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: "10px 22px", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Settings</button>
              <button style={{ background: "transparent", color: t.inkSecondary, border: "none", padding: "10px 12px", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, cursor: "pointer", borderBottom: `1px solid ${t.ruleDefault}`, borderRadius: 0 }}>Learn more</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 12 }}>
              <button style={{ background: t.emPrimary, color: t.inkInverse, border: "none", borderRadius: 6, padding: "5px 12px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Small</button>
              <button style={{ background: "transparent", color: t.inkPrimary, border: `1px solid ${t.ruleDefault}`, borderRadius: 6, padding: "5px 12px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Small Ghost</button>
              <button style={{ background: t.bgInset, color: t.inkTertiary, border: "none", borderRadius: 6, padding: "5px 12px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, opacity: 0.45 }}>Disabled</button>
            </div>
          </Section>

          {/* ======== STATUS INDICATORS ======== */}
          <Section t={t} title="Status & Badges" sub="Monochrome badges. Dot indicators instead of colored fills.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {[
                { label: "BETA" }, { label: "SPONSORED" }, { label: "USDC ON BASE" }, { label: "$10-15 CPM" },
              ].map((b, i) => (
                <span key={i} style={{
                  fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
                  background: t.bgInset, color: t.inkSecondary, padding: "3px 8px", borderRadius: 4,
                }}>{b.label}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              {[
                { label: "Active", c: t.inkPrimary },
                { label: "Earning", c: t.inkPrimary, pulse: true },
                { label: "Idle", c: t.inkTertiary },
                { label: "Paused", c: t.inkFaint },
                { label: "Error", c: t.statusNeg },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: s.c, flexShrink: 0,
                    animation: s.pulse ? "pulse 2s ease-in-out infinite" : "none",
                  }} />
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: t.inkSecondary }}>{s.label}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ======== CARDS ======== */}
          <Section t={t} title="Cards" sub="Standard, Data (dot-grid + ink border), Terminal (always dark / sharp), and Digest.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
              {/* Standard */}
              <div style={{ background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: 20 }}>
                <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 15, color: t.inkPrimary, marginBottom: 6 }}>Standard Card</div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: t.inkSecondary, lineHeight: 1.5 }}>
                  General content panels. Border, no shadow, warm surface.
                </div>
              </div>
              {/* Data Card */}
              <div style={{
                background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: 20,
                borderLeft: `2px solid ${t.inkPrimary}`, position: "relative", overflow: "hidden",
              }}>
                <DotGrid t={t} opacity={0.2} />
                <div style={{ position: "relative" }}>
                  <EarningsCounter t={t} />
                </div>
              </div>
              {/* Terminal */}
              <TerminalTV />
            </div>
            {/* Digest — full width */}
            <DigestCard t={t} />
          </Section>

          {/* ======== DATA TABLE ======== */}
          <Section t={t} title="Data Table" sub="Bloomberg-style. Weight creates hierarchy — bold for earnings, regular for context.">
            <div style={{ background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.ruleDefault}` }}>
                    {["Surface", "Impressions", "eCPM", "Earned", ""].map((h, i) => (
                      <th key={i} style={{
                        fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary,
                        letterSpacing: "0.07em", padding: "10px 16px", textAlign: "left",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { s: "Terminal TV", imp: "1,247", cpm: "$12.40", earned: "$5.40", active: true },
                    { s: "Companion Tab", imp: "892", cpm: "$14.20", earned: "$4.20", active: true },
                    { s: "Challenges", imp: "156", cpm: "$32.00", earned: "$3.10", active: true },
                    { s: "Audio", imp: "341", cpm: "$18.50", earned: "$1.02", active: false },
                    { s: "Digest", imp: "89", cpm: "$8.20", earned: "$0.60", active: true },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderBottom: i < 4 ? `1px solid ${t.ruleSubtle}` : "none" }}>
                      <td style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: t.inkPrimary, padding: "10px 16px" }}>{r.s}</td>
                      <td style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: t.inkTertiary, padding: "10px 16px" }}>{r.imp}</td>
                      <td style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: t.inkSecondary, padding: "10px 16px" }}>{r.cpm}</td>
                      <td style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 700, color: t.inkPrimary, padding: "10px 16px" }}>{r.earned}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: r.active ? t.inkPrimary : t.inkFaint }} />
                          <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: r.active ? t.inkSecondary : t.inkTertiary }}>
                            {r.active ? "Active" : "Paused"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ======== DOT GRID ======== */}
          <Section t={t} title="Dot-Grid Texture" sub="The signature. Financial paper grain meets terminal phosphor.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "16px / 50%", sp: "16px 16px", op: 0.5 },
                { label: "24px / 50%", sp: "24px 24px", op: 0.5 },
                { label: "16px — earning", sp: "16px 16px", op: 0.35, animate: true },
              ].map((g, i) => (
                <div key={i} style={{
                  height: 88, borderRadius: 8, border: `1px solid ${t.ruleDefault}`,
                  position: "relative", overflow: "hidden", background: t.bgSurface,
                }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    backgroundImage: `radial-gradient(circle, ${t.dotGrid} 1px, transparent 1px)`,
                    backgroundSize: g.sp, opacity: g.op,
                    animation: g.animate ? "dotPulse 3s ease-in-out infinite" : "none",
                  }} />
                  <div style={{
                    position: "absolute", bottom: 8, left: 10,
                    fontFamily: "'JetBrains Mono'", fontSize: 10, color: t.inkTertiary,
                  }}>{g.label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ======== PROGRESS ======== */}
          <Section t={t} title="Progress" sub="Subscription offset tracking. Ink fill — no color needed.">
            <div style={{ background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "baseline" }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, color: t.inkPrimary }}>Cursor Pro Offset</span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 600, color: t.inkPrimary }}>$14.72 / $20.00</span>
              </div>
              <div style={{ height: 4, background: t.bgInset, borderRadius: 9999, overflow: "hidden" }}>
                <div style={{ width: "73.6%", height: "100%", background: t.inkPrimary, borderRadius: 9999, transition: "width 600ms ease-out" }} />
              </div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: t.inkTertiary, marginTop: 6 }}>73.6% covered this month</div>
            </div>
          </Section>

          {/* ======== INPUTS ======== */}
          <Section t={t} title="Inputs" sub="Monospaced numbers. Clean borders.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 500, color: t.inkTertiary, display: "block", marginBottom: 4 }}>Withdrawal</label>
                <div style={{
                  display: "flex", alignItems: "center", background: t.bgSurface,
                  border: `1px solid ${t.ruleStrong}`, borderRadius: 8, padding: "0 14px", height: 40,
                }}>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 16, fontWeight: 600, color: t.inkPrimary, fontVariantNumeric: "tabular-nums" }}>$14.72</span>
                </div>
              </div>
              <div>
                <label style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 500, color: t.inkTertiary, display: "block", marginBottom: 4 }}>Frequency</label>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, background: t.bgSurface,
                  border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: "0 14px", height: 40,
                }}>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 16, color: t.inkPrimary }}>4</span>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: t.inkTertiary }}>ads/hr</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 20, borderRadius: 9999, background: t.emPrimary, position: "relative", cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: t.inkInverse, position: "absolute", top: 2, left: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }} />
                </div>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: t.inkPrimary }}>Audio</span>
              </div>
            </div>
          </Section>

          {/* ======== SPACING & RADIUS ======== */}
          <Section t={t} title="Spacing & Radius" sub="4px base. Sharp corners for terminal, soft for UI.">
            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 10 }}>SPACING</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                  {[4, 8, 12, 16, 24, 32, 48, 64].map(px => (
                    <div key={px} style={{ textAlign: "center" }}>
                      <div style={{ width: Math.max(px, 6), height: Math.max(px, 6), background: t.inkPrimary, borderRadius: 2, margin: "0 auto 4px", opacity: 0.12 }} />
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: t.inkTertiary }}>{px}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: t.inkTertiary, letterSpacing: "0.08em", marginBottom: 10 }}>RADIUS</div>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                  {[{ l: "0", r: 0 }, { l: "4", r: 4 }, { l: "8", r: 8 }, { l: "12", r: 12 }, { l: "pill", r: 9999 }].map(s => (
                    <div key={s.l} style={{ textAlign: "center" }}>
                      <div style={{ width: 40, height: 40, border: `1.5px solid ${t.inkPrimary}`, borderRadius: s.r, margin: "0 auto 4px", opacity: 0.5 }} />
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: t.inkTertiary }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ======== BRAND RULES ======== */}
          <Section t={t} title="Brand Rules" sub="The constraints that make this work.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: 20 }}>
                <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 13, color: t.inkPrimary, marginBottom: 10 }}>DO</div>
                {[
                  "Monochrome everything",
                  "Money = bold monospace, not color",
                  "Dot-grid for industrial texture",
                  "Space Mono headlines always",
                  "Sharp corners for terminal",
                  "Flat surfaces, no heavy shadows",
                  "Let the $ sign do the work",
                ].map((r, i) => (
                  <div key={i} style={{ fontFamily: "'DM Sans'", fontSize: 12, color: t.inkSecondary, padding: "3px 0", display: "flex", gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 700, opacity: 0.35 }}>+</span> {r}
                  </div>
                ))}
              </div>
              <div style={{ background: t.bgSurface, border: `1px solid ${t.ruleDefault}`, borderRadius: 8, padding: 20 }}>
                <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 13, color: t.inkPrimary, marginBottom: 10 }}>DON'T</div>
                {[
                  "No green-for-money (we're not a scam)",
                  "No brand accent color at all",
                  "No gradient backgrounds",
                  "No emoji in product UI",
                  "No colored CTA buttons",
                  "No crypto hype language",
                  "No heavy rounded aesthetic",
                ].map((r, i) => (
                  <div key={i} style={{ fontFamily: "'DM Sans'", fontSize: 12, color: t.inkSecondary, padding: "3px 0", display: "flex", gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 700, opacity: 0.35 }}>-</span> {r}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ======== PHILOSOPHY ======== */}
          <div style={{
            marginTop: 48, padding: 24, background: t.bgSurface,
            border: `1px solid ${t.ruleDefault}`, borderRadius: 8,
            position: "relative", overflow: "hidden",
          }}>
            <DotGrid t={t} opacity={0.18} />
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 15, color: t.inkPrimary, marginBottom: 8 }}>
                Why monochrome?
              </div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 14, lineHeight: 1.65, color: t.inkSecondary, maxWidth: 560 }}>
                Stripe processes trillions without green. Nothing ships hardware you buy without green. Bloomberg moves billions on monochrome screens. We convey financial precision through typography, weight, and motion — not color. The{" "}
                <span style={{ fontFamily: "'JetBrains Mono'", fontWeight: 700, fontSize: 13 }}>$14.72</span>{" "}
                in JetBrains Mono Bold IS the money signal.
              </div>
            </div>
          </div>

          {/* ======== FOOTER ======== */}
          <div style={{
            marginTop: 48, paddingTop: 16, borderTop: `1px solid ${t.ruleDefault}`,
            display: "flex", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: "'Space Mono'", fontSize: 12, color: t.inkTertiary }}>dev drip v1.1</span>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: t.inkFaint }}>Powered by USDC on Base</span>
          </div>
        </div>
      </div>
    </>
  );
}
