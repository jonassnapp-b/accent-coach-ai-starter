// src/pages/Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Send } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";

const FEEDBACK_EMAIL = "admin@fluentup.app";
const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

/* ---------- UI helpers ---------- */
/* ---------- UI helpers ---------- */
function Group({ children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div className="ios-group">
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {i !== items.length - 1 ? <div className="ios-divider" /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function Row({ label, children, hint }) {
  return (
    <div className="ios-row">
      <div className="ios-row-left">
        <div className="ios-row-label">{label}</div>
        {hint ? <div className="ios-row-hint">{hint}</div> : null}
      </div>

      <div className="ios-row-right">{children}</div>
    </div>
  );
}

function Section({ title, children, noPanel = false, first = false }) {
  return (
    <div
      className="grid"
      style={{
        marginTop: first ? 7 : 18,
        rowGap: 10,
      }}
    >
      {/* heading OUTSIDE the group */}
      <div
        style={{
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 900,
          fontSize: 13,
          color: "var(--muted)",
          paddingLeft: 6,
          marginTop: 2,
        }}
      >
        {title}
      </div>

      {noPanel ? children : <Group>{children}</Group>}
    </div>
  );
}






function ControlSelect(props) {
  return (
    <select
      {...props}
      className={[
        "rounded-xl px-3 py-[10px] pr-9 text-sm outline-none",
        "border",
        "focus:ring-2 focus:ring-[rgba(33,150,243,.35)]",
        props.className || "",
      ].join(" ")}
    style={{
  background: "#2196F3",
  color: "white",
  border: "none",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  fontWeight: 800,     // ✅ match btn
  fontSize: 16,        // ✅ samme “feel” som knappen
  lineHeight: 1.2,
}}



    />
  );
}

function ControlInput(props) {
  return (
    <input
      {...props}
      className={[
        "rounded-xl px-3 py-[10px] text-sm outline-none",
        "border",
        "focus:ring-2 focus:ring-[rgba(33,150,243,.35)]",
        props.className || "",
      ].join(" ")}
      style={{
        background: "var(--panel-bg)",
        color: "var(--panel-text)",
        borderColor: "var(--panel-border)",
      }}
    />
  );
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function slackLabel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "Recommended";
  if (n <= -0.35) return "Easier";
  if (n >= 0.35) return "Stricter";
  return "Recommended";
}

/* ---------- Main ---------- */
export default function Settings() {
  const { settings: s, setSettings: setS } = useSettings();

  // local feedback state
  const [fb, setFb] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbMsg, setFbMsg] = useState("");





  const clearLocalData = () => {
    if (!confirm("This will reset your settings and locally cached clips (if any). Continue?")) return;
    try {
      localStorage.removeItem("ac_settings_v1");
      location.reload();
    } catch {
      // ignore
    }
  };

  async function sendFeedback() {
    const text = fb.trim();
    if (!text) return;

    setFbSending(true);
    setFbMsg("");

    try {
      const base = (import.meta.env.VITE_API_BASE || localStorage.getItem("apiBase") || window.location.origin).replace(
        /\/+$/,
        ""
      );
      const r = await fetch(`${base}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userAgent: navigator.userAgent, ts: Date.now() }),
      });
      if (!r.ok) throw new Error(await r.text());

      setFb("");
      setFbMsg("Thanks — sent!");
    } catch {
      const subject = encodeURIComponent("Accent Coach AI — Problem report");
      const body = encodeURIComponent(text + "\n\n—\nUA: " + navigator.userAgent);
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    } finally {
      setFbSending(false);
    }
  }

  const volumeVal = useMemo(() => {
    const v = Number(s.volume);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }, [s.volume]);

  /* ---------- Render ---------- */
  return (
   <div
  className="page"
 style={{
  position: "relative",
  minHeight: "100vh",
  background: "#FFFFFF",
  paddingBottom: 0,
  paddingTop: "var(--safe-top)",
  display: "flex",
  flexDirection: "column",
}}


>
  <style>{`
  /* Blue filled + visible unfilled track */
  input[type="range"].range-blue-white{
    -webkit-appearance: none;
    appearance: none;
    height: 24px;              /* gives room for thumb */
    background: transparent;   /* track is drawn in pseudo elements */
  }

  /* WebKit track */
  input[type="range"].range-blue-white::-webkit-slider-runnable-track{
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      #2196F3 0%,
      #2196F3 var(--pct),
      rgba(17,24,39,0.18) var(--pct),
      rgba(17,24,39,0.18) 100%
    );
  }

  /* WebKit thumb */
  input[type="range"].range-blue-white::-webkit-slider-thumb{
    -webkit-appearance: none;
    appearance: none;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #2196F3;
    border: 4px solid #ffffff;
    box-shadow: 0 10px 20px rgba(0,0,0,0.18);
    margin-top: -9px; /* centers thumb on 10px track */
  }

  /* Firefox track + progress */
  input[type="range"].range-blue-white::-moz-range-track{
    height: 10px;
    border-radius: 999px;
    background: rgba(17,24,39,0.18);
  }
  input[type="range"].range-blue-white::-moz-range-progress{
    height: 10px;
    border-radius: 999px;
    background: #2196F3;
  }
  input[type="range"].range-blue-white::-moz-range-thumb{
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #2196F3;
    border: 4px solid #ffffff;
    box-shadow: 0 10px 20px rgba(0,0,0,0.18);
  }
`}</style>

{/* Force blue backdrop even if parent/shell paints background */}


      <div
  style={{
    position: "relative",
    zIndex: 1,
    flex: 1,
    display: "flex",
    flexDirection: "column",
  }}
>
  <div className="mx-auto max-w-[720px]" style={{ width: "100%" }}>








{/* Spacer (match Practice header → cards gap) */}


{/* White sheet under blue header */}
<div
  style={{
  flex: 1,
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  background: "transparent",
  borderRadius: 0,
  boxShadow: "none",
  padding: "0 16px",
  paddingTop: 12,
  paddingBottom: "calc(16px + var(--safe-bottom))",
}}

>


    <div className="grid gap-4">

         

       {/* Speaking */}
<Section title="SPEAKING" first>
  <Row label="Default accent" hint="Used for IPA, target, and native TTS language.">
    <div className="inline-flex items-center gap-2">
      <ControlSelect
        value={s.accentDefault}
        onChange={(e) => setS({ ...s, accentDefault: e.target.value })}
      >
        <option value="en_us">🇺🇸 American English (US)</option>
        <option value="en_br">🇬🇧 British English (UK)</option>
      </ControlSelect>
    </div>
  </Row>
   {(() => {
  const slackVal = clamp(Number(s.slack ?? 0), -1, 1);

  return (
    <div className="ios-row" style={{ alignItems: "flex-start" }}>
      <div>
        <div className="font-medium" style={{ color: "var(--text)" }}>
          Difficulty (Slack)
        </div>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Controls scoring strictness. Easier = more forgiving. Stricter = harder.
        </div>
      </div>

      <div className="grid gap-2">
        <div style={{ color: "var(--muted)", fontWeight: 800 }}>
          {slackLabel(slackVal)} ({slackVal.toFixed(2)})
        </div>

        <input
          type="range"
          min="-1"
          max="1"
          step="0.05"
          value={slackVal}
          onChange={(e) => setS({ ...s, slack: Number(e.target.value) })}
          className="w-56 range-blue-white"
          style={{
            "--pct": `${Math.round(((slackVal + 1) / 2) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
})()}


</Section>



          {/* Audio */}
          <Section title="AUDIO">
            <Row label="Volume">
              <div className="flex items-center gap-3">
                <input
  type="range"
  min="0"
  max="1"
  step="0.01"
  value={volumeVal}
  onChange={(e) => setS({ ...s, volume: Number(e.target.value) })}
  className="w-56 range-blue-white"
  style={{ "--pct": `${Math.round(volumeVal * 100)}%` }}
/>


                <span className="w-12 text-right" style={{ color: "var(--muted)" }}>
                  {Math.round(volumeVal * 100)}%
                </span>
              </div>
            </Row>
          </Section>

          {/* Privacy & data (unchanged) */}
          <Section title="PRIVACY & DATA">
            <Row
              label="Send audio to server"
              hint="Needed for cloud scoring. Turn off to keep audio on this device (some features will be disabled)."
            >
              <input
                type="checkbox"
                checked={!!s.sendAudioToServer}
                onChange={(e) => setS({ ...s, sendAudioToServer: e.target.checked })}
              />
            </Row>

            <Row label="Keep recordings locally" hint="Store clips in this browser so you can replay them. Nothing is uploaded.">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!s.keepRecordings}
                  onChange={(e) => setS({ ...s, keepRecordings: e.target.checked })}
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  Retention
                </span>
                <ControlInput
                  type="number"
                  min="1"
                  max="30"
                  value={s.retentionDays ?? 7}
                  onChange={(e) => setS({ ...s, retentionDays: Number(e.target.value) })}
                  className="w-20"
                />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  days
                </span>
              </div>
            </Row>

         <ActionRow>
  <button
    onClick={clearLocalData}
    type="button"
    style={{
      width: "100%",
      height: 48,
      borderRadius: 14,
      border: "none",
      background: "#2196F3",
      color: "white",
      fontWeight: 900,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      cursor: "pointer",
    }}
  >
    <Trash2 className="h-4 w-4" />
    Clear cached data
  </button>
</ActionRow>

          </Section>
{/* Feedback & Support */}
<Section title="FEEDBACK AND SUPPORT" noPanel>
  <div
    style={{
      borderRadius: 28,
      padding: 22,
      background: "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.10)",
      boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
    }}
  >
    <div
      style={{
        fontSize: 44,
        lineHeight: 1.02,
        fontWeight: 950,
        letterSpacing: -0.8,
        color: "var(--text)",
        textAlign: "center",
        marginTop: 6,
      }}
    >
      We’d love to hear
      <br />
      from you
    </div>

    <div
      style={{
        marginTop: 18,
        color: "var(--muted)",
        fontWeight: 650,
        fontSize: 16,
        lineHeight: 1.55,
      }}
    >
      We’re the team behind FluentUp. Like many of our users, we’re non-native English speakers, so we care deeply about making pronunciation practice feel simple, honest, and actually useful.
      <br />
      <br />
      If something feels confusing, broken, or you have an idea that would make the app better, write it here. we read every message.
    </div>

    <div style={{ marginTop: 18 }}>
      <textarea
        value={fb}
        onChange={(e) => setFb(e.target.value)}
        rows={4}
        placeholder="Describe the issue…"
        className="w-full outline-none"
        style={{
          borderRadius: 18,
          padding: 14,
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.10)",
          color: "var(--text)",
          resize: "vertical",
        }}
      />
    </div>

    <div style={{ marginTop: 14, display: "grid", gap: 10, justifyItems: "center" }}>
      <button
        type="button"
        onClick={sendFeedback}
        disabled={!fb.trim() || fbSending}
        style={{
          width: "100%",
          maxWidth: 520,
          height: 64,
          borderRadius: 999,
          border: "none",
          background: "#2196F3",
          color: "white",
          fontWeight: 950,
          fontSize: 20,
          cursor: !fb.trim() || fbSending ? "not-allowed" : "pointer",
          opacity: !fb.trim() || fbSending ? 0.55 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Send className="h-5 w-5" />
        {fbSending ? "Sending…" : "Contact Us"}
      </button>

      {fbMsg ? (
        <div style={{ color: "rgba(17,24,39,0.60)", fontWeight: 800, fontSize: 13 }}>{fbMsg}</div>
      ) : null}
    </div>
  </div>
</Section>


               </div>
      </div>
    </div>
  </div>
</div>
  );
}

