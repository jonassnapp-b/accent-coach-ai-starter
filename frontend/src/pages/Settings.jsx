// src/pages/Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trash2,
  Send,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Bell,
  Info,
  Mail,
} from "lucide-react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useSettings } from "../lib/settings-store.jsx";
import { useProStatus } from "../providers/PurchasesProvider.jsx";
const FEEDBACK_EMAIL = "admin@fluentup.app";
const DAILY_REMINDER_NOTIFICATION_ID = 7001;

function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}

function formatReminderTimeLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "17.00";

  const [h = "17", m = "00"] = raw.split(":");
  return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

function parseReminderTime(value) {
  const raw = String(value || "17:00").trim();
  const [hRaw = "17", mRaw = "00"] = raw.split(":");

  const hour = Math.max(0, Math.min(23, Number(hRaw)));
  const minute = Math.max(0, Math.min(59, Number(mRaw)));

  return {
    hour: Number.isFinite(hour) ? hour : 17,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

async function ensureNotificationPermission() {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === "granted") return true;

  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
}

async function cancelDailyPracticeReminder() {
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: DAILY_REMINDER_NOTIFICATION_ID }],
    });
  } catch {}
}

async function scheduleDailyPracticeReminder(timeValue) {
  const { hour, minute } = parseReminderTime(timeValue);

  await cancelDailyPracticeReminder();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: DAILY_REMINDER_NOTIFICATION_ID,
        title: "Time to practice",
        body: "Spend a few minutes improving your Pronunciation in FluentUp.",
        schedule: {
          repeats: true,
          every: "day",
          on: {
            hour,
            minute,
          },
        },
      },
    ],
  });
}

/* ---------- UI helpers ---------- */
/* ---------- UI helpers ---------- */
function Group({ children }) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <div
      style={{
        background: "#F3F3F3",
        borderRadius: 28,
        overflow: "hidden",
      }}
    >
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {i !== items.length - 1 ? (
            <div
              style={{
                height: 1,
                background: "rgba(0,0,0,0.08)",
                marginLeft: 24,
                marginRight: 24,
              }}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function Row({ label, children, hint }) {
  return (
    <div
      style={{
        minHeight: 92,
        padding: "22px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 22,
            lineHeight: 1.15,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          {label}
        </div>

        {hint ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 15,
              lineHeight: 1.35,
              color: "rgba(17,24,39,0.55)",
              fontWeight: 500,
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
function ActionRow({ children }) {
  return (
    <div
      style={{
        padding: "18px 24px",
      }}
    >
      <div style={{ width: "100%" }}>{children}</div>
    </div>
  );
}

function MenuRow({ icon: Icon, label, value, onClick, danger = false, noDivider = false }) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          minHeight: 92,
          padding: "22px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <Icon
            className="h-7 w-7"
            style={{
              color: danger ? "#111827" : "#111827",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 22,
              lineHeight: 1.15,
              fontWeight: 700,
              color: danger ? "#111827" : "#111827",
            }}
          >
            {label}
          </div>
        </div>

        {value ? (
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "rgba(17,24,39,0.38)",
              marginLeft: 12,
              flexShrink: 0,
            }}
          >
            {value}
          </div>
        ) : (
          <ChevronRight className="h-5 w-5" style={{ color: "rgba(17,24,39,0.35)", flexShrink: 0 }} />
        )}
      </button>

      {!noDivider ? (
        <div
          style={{
            height: 1,
            background: "rgba(0,0,0,0.08)",
            marginLeft: 24,
            marginRight: 24,
          }}
        />
      ) : null}
    </>
  );
}

function Sheet({ title, onBack, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#FFFFFF",
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 24px" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "#FFFFFF",
            zIndex: 2,
            paddingTop: 12,
            paddingBottom: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 44px",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={onBack}
              style={{
                width: 44,
                height: 44,
                border: "none",
                background: "transparent",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ChevronLeft className="h-8 w-8" style={{ color: "#111827" }} />
            </button>

            <div
              style={{
                textAlign: "center",
                fontSize: 34,
                lineHeight: 1.05,
                fontWeight: 900,
                color: "#000",
              }}
            >
              {title}
            </div>

            <div />
          </div>
        </div>

        {children}
      </div>
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
  height: 50,
  minWidth: 240,
  paddingLeft: 16,
  paddingRight: 40,
  borderRadius: 999,
  background: "#FFFFFF",
  color: "#111827",
  border: "1px solid rgba(0,0,0,0.08)",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  fontWeight: 700,
  fontSize: 16,
  lineHeight: 1.2,
  boxShadow: "none",
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
  height: 50,
  borderRadius: 18,
  background: "#FFFFFF",
  color: "#111827",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "none",
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
const { isPro } = useProStatus();
const nav = useNavigate();
const [activeSheet, setActiveSheet] = useState(null);
const [notificationsBusy, setNotificationsBusy] = useState(false);
const [notificationsError, setNotificationsError] = useState("");
  // local feedback state

function openPaywall(src) {
  nav(`/pro?src=${encodeURIComponent(src)}&return=/settings`);
}

function openSupportEmail() {
  window.location.href = `mailto:${FEEDBACK_EMAIL}`;
}
async function handleDailyReminderToggle(nextChecked) {
  if (!isNative()) {
    setNotificationsError("Notifications only work in the iPhone app.");
    return;
  }

  setNotificationsBusy(true);
  setNotificationsError("");

  try {
    if (nextChecked) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        setNotificationsError("Notification permission was not granted.");
        return;
      }

      await scheduleDailyPracticeReminder(s.dailyReminderTime || "17:00");
    } else {
      await cancelDailyPracticeReminder();
    }

    setS({
      ...s,
      dailyPracticeReminders: nextChecked,
    });
  } catch (err) {
    setNotificationsError(err?.message || "Failed to update notifications.");
  } finally {
    setNotificationsBusy(false);
  }
}

async function handleDailyReminderTimeChange(nextTime) {
  setNotificationsBusy(true);
  setNotificationsError("");

  try {
    setS({
      ...s,
      dailyReminderTime: nextTime,
    });

    if (s.dailyPracticeReminders && isNative()) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        setNotificationsError("Notification permission was not granted.");
        return;
      }

      await scheduleDailyPracticeReminder(nextTime);
    }
  } catch (err) {
    setNotificationsError(err?.message || "Failed to update reminder time.");
  } finally {
    setNotificationsBusy(false);
  }
}

  const clearLocalData = () => {
    if (!confirm("This will reset your settings and locally cached clips (if any). Continue?")) return;
    try {
      localStorage.removeItem("ac_settings_v1");
      location.reload();
    } catch {
      // ignore
    }
  };

  const volumeVal = useMemo(() => {
    const v = Number(s.volume);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }, [s.volume]);

  /* ---------- Render ---------- */
  return (
   <div
  className="page"
  data-page-scroll="true"
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
    paddingTop: 18,
    paddingBottom: "calc(24px + var(--safe-bottom))",
  }}
>
<div
  style={{
    textAlign: "center",
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#000",
    marginTop: 6,
    marginBottom: 18,
  }}
>
  Settings
</div>

    <div className="grid gap-4">
{!isPro && (
  <button
    type="button"
    onClick={() => openPaywall("settings_upgrade")}
    style={{
      width: "100%",
      height: 72,
      border: "none",
      borderRadius: 999,
      background: "#2952F3",
      color: "#FFFFFF",
      fontSize: 21,
      fontWeight: 900,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      boxShadow: "none",
      cursor: "pointer",
    }}
  >
    <Sparkles className="h-5 w-5" />
    Upgrade to FluentUp Pro
  </button>
)}
        <Group>
  <MenuRow
    icon={Bell}
    label="Notifications"
    onClick={() => setActiveSheet("notifications")}
  />

  <MenuRow
    icon={Info}
    label="About"
    onClick={() => setActiveSheet("about")}
  />

  <MenuRow
    icon={Sparkles}
    label="Preferences"
    onClick={() => setActiveSheet("preferences")}
  />

  <MenuRow
    icon={Sparkles}
    label="Privacy & Data"
    onClick={() => setActiveSheet("privacy")}
  />

  <MenuRow
    icon={Mail}
    label="Contact Support"
    onClick={openSupportEmail}
    noDivider
  />
</Group>

{activeSheet === "preferences" && (
  <Sheet title="Preferences" onBack={() => setActiveSheet(null)}>
    <div style={{ display: "grid", gap: 18 }}>
      <Group>
        <div className="ios-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div>
            <div className="ios-row-label">Default accent</div>
            <div className="ios-row-hint">Used for IPA, target, and native TTS language.</div>
          </div>

          <div style={{ width: "100%" }}>
            <ControlSelect
              value={s.accentDefault}
              onChange={(e) => setS({ ...s, accentDefault: e.target.value })}
              style={{ width: "100%", maxWidth: 520 }}
            >
              <option value="en_us">🇺🇸 American English (US)</option>
              <option value="en_br">🇬🇧 British English (UK)</option>
            </ControlSelect>
          </div>
        </div>

        {(() => {
          const slackVal = clamp(Number(s.slack ?? 1), -1, 1);

          return (
            <div className="ios-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div>
                <div className="ios-row-label">Difficulty</div>
                <div className="ios-row-hint">Controls scoring strictness. Easier = more forgiving. Stricter = harder.</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
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
                  className="range-blue-white"
                  style={{
                    "--pct": `${Math.round(((slackVal + 1) / 2) * 100)}%`,
                    width: "100%",
                    minWidth: 0,
                  }}
                />
              </div>
            </div>
          );
        })()}
      </Group>

      <Group>
        <div className="ios-row">
          <div className="ios-row-left">
            <div className="ios-row-label">Volume</div>
          </div>

          <div className="ios-row-right" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volumeVal}
                onChange={(e) => setS({ ...s, volume: Number(e.target.value) })}
                className="range-blue-white"
                style={{
                  "--pct": `${Math.round(volumeVal * 100)}%`,
                  width: "100%",
                  minWidth: 0,
                }}
              />

              <span style={{ width: 44, textAlign: "right", color: "var(--muted)", fontWeight: 800 }}>
                {Math.round(volumeVal * 100)}%
              </span>
            </div>
          </div>
        </div>
      </Group>
    </div>
  </Sheet>
)}
{activeSheet === "privacy" && (
  <Sheet title="Privacy & Data" onBack={() => setActiveSheet(null)}>
    <Group>
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

      <div className="ios-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
        <div>
          <div className="ios-row-label">Keep recordings locally</div>
          <div className="ios-row-hint">Store clips in this browser so you can replay them. Nothing is uploaded.</div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
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
      </div>

      <ActionRow>
        <button
          onClick={clearLocalData}
          type="button"
          style={{
            width: "100%",
            height: 58,
            borderRadius: 18,
            border: "none",
            background: "#FFFFFF",
            color: "#111827",
            fontWeight: 800,
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
    </Group>
  </Sheet>
)}




{activeSheet === "notifications" && (
  <Sheet title="Notifications" onBack={() => setActiveSheet(null)}>
    <Group>
      <Row label="Daily practice reminders">
        <label
          style={{
            position: "relative",
            display: "inline-flex",
            width: 78,
            height: 44,
            cursor: notificationsBusy ? "not-allowed" : "pointer",
            opacity: notificationsBusy ? 0.6 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={!!s.dailyPracticeReminders}
            disabled={notificationsBusy}
            onChange={(e) => handleDailyReminderToggle(e.target.checked)}
            style={{
              position: "absolute",
              opacity: 0,
              width: 0,
              height: 0,
            }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: s.dailyPracticeReminders ? "#8EA2FF" : "#D9D9D9",
              transition: "background 160ms ease",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 3,
              left: s.dailyPracticeReminders ? 37 : 3,
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              transition: "left 160ms ease",
            }}
          />
        </label>
      </Row>

      <Row label="Reminder time">
        <input
          type="time"
          value={s.dailyReminderTime || "17:00"}
          disabled={!s.dailyPracticeReminders || notificationsBusy}
          onChange={(e) => handleDailyReminderTimeChange(e.target.value)}
          style={{
            width: 148,
            height: 50,
            borderRadius: 16,
            border: "none",
            background: "#ECECEC",
            color: "rgba(17,24,39,0.55)",
            fontSize: 18,
            fontWeight: 700,
            textAlign: "center",
            padding: "0 14px",
            opacity: !s.dailyPracticeReminders ? 0.55 : 1,
          }}
        />
      </Row>
    </Group>

    {notificationsError ? (
      <div
        style={{
          marginTop: 14,
          padding: "0 6px",
          fontSize: 14,
          lineHeight: 1.4,
          color: "#DC2626",
          fontWeight: 600,
        }}
      >
        {notificationsError}
      </div>
    ) : null}
  </Sheet>
)}

{activeSheet === "about" && (
  <Sheet title="About" onBack={() => setActiveSheet(null)}>
    <Group>
      <Row label="App Version" hint="FluentUp">
        <div style={{ color: "rgba(17,24,39,0.45)", fontWeight: 700 }}>1.1.0</div>
      </Row>
    </Group>
  </Sheet>
)}
               </div>
      </div>
    </div>
  </div>
</div>
  );
}

