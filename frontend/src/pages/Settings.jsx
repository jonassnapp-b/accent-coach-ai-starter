// src/pages/Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Send } from "lucide-react";
import { useSettings } from "../lib/settings-store.jsx";

const FEEDBACK_EMAIL = "admin@fluentup.app";
const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

/* ---------- UI helpers ---------- */
function Row({ label, children, hint }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 py-3">
      <div className="sm:min-w-[220px]">
        <div className="font-medium" style={{ color: "var(--text)" }}>
          {label}
        </div>
        {hint ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Section({ title, children, noPanel = false }) {
  return (
    <div className="grid gap-3" style={{ marginTop: 0 }}>

      {/* heading OUTSIDE the card */}
      <div
        style={{
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 900,
          fontSize: 13,
          color: "var(--muted)",
          paddingLeft: 6,
        }}
      >
        {title}
      </div>

      {/* card */}
      {noPanel ? children : <div className="rounded-2xl panel">{children}</div>}
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
    background: "#2196F3",
  }}
>

      <div className="mx-auto max-w-[720px]">





  {/* Blue header (only title lives here) */}
<div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 18px", color: "white" }}>
  <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.4 }}>
    Settings
  </div>
</div>


{/* Spacer (match Practice header → cards gap) */}


{/* White sheet under blue header */}
<div
  style={{
    background: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: "0 -1px 0 rgba(255,255,255,0.10), 0 18px 40px rgba(0,0,0,0.10)",
    padding: "18px 16px 110px",
  }}
>

    <div className="grid gap-4">

         

       {/* Speaking */}
<Section title="SPEAKING">
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

            <div className="mt-3">
           <button
  onClick={clearLocalData}
  className="btn btn-ghost"
  style={{
    background: "#2196F3",
    borderColor: "transparent",
    color: "white",
  }}
>
  <Trash2 className="h-4 w-4" /> Clear cached data
</button>


            </div>
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
      If something feels confusing, broken, or you have an idea that would make the app better, write it here — we read every message.
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
  );
}
