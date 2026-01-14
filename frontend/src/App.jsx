// src/App.jsx
import React, { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import { SettingsProvider } from "./lib/settings-store.jsx";

import Record from "./pages/Record.jsx";
import Feedback from "./pages/Feedback.jsx";
import { Mic, AudioWaveform, Target, Settings as SettingsIcon } from "lucide-react";



// Lazy-load sider der er tungere
const ProgressiveSentenceMastery = lazy(() => import("./pages/ProgressiveSentenceMastery.jsx"));
const WeaknessLab = lazy(() => import("./pages/WeaknessLab.jsx"));
const Settings   = lazy(() => import("./pages/Settings.jsx"));
const Bookmarks  = lazy(() => import("./pages/Bookmarks.jsx"));



import { submitReferralOpen } from "./lib/api.js";

// 🔔 Push (native only)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import "./styles.css";

/* ---------------- Prefetch helpers (route-level) ---------------- */
const routePrefetch = {
  "/imitate":    () => import("./pages/ProgressiveSentenceMastery.jsx"),
  "/weakness":   () => import("./pages/WeaknessLab.jsx"),
  "/settings":   () => import("./pages/Settings.jsx"),
  "/bookmarks":  () => import("./pages/Bookmarks.jsx"),
  };

function prefetchRoute(path) {
  try { routePrefetch[path]?.(); } catch {}
}

/* ✅ Practice Gate (prevents flash by redirecting BEFORE Record renders) */
const PRACTICE_LAST_ROUTE_KEY = "ac_practice_last_route_v1";
const FEEDBACK_KEY = "ac_feedback_result_v1";
const LAST_RESULT_KEY = "ac_last_result_v1";

function PracticeGate() {
  let shouldGoFeedback = false;

  try {
    const last = sessionStorage.getItem(PRACTICE_LAST_ROUTE_KEY);
    const hasResult =
      !!sessionStorage.getItem(FEEDBACK_KEY) ||
      !!sessionStorage.getItem(LAST_RESULT_KEY);

    shouldGoFeedback = last === "/feedback" && hasResult;
  } catch {
    shouldGoFeedback = false;
  }

  if (shouldGoFeedback) {
    return <Navigate to="/feedback" replace />;
  }

  return <Record />;
}

/* ---------------- Tabs ---------------- */
/* ---------------- Tabs ---------------- */
const TABS = [
  { path: "/record",   label: "Practice",  Icon: Mic,       element: <PracticeGate /> },
  { path: "/imitate",  label: "Coach",     Icon: AudioWaveform,  element: <ProgressiveSentenceMastery /> },
  { path: "/weakness", label: "Weakness",  Icon: Target,    element: <WeaknessLab /> },
  { path: "/settings", label: "Settings",  Icon: SettingsIcon, element: <Settings /> },
];





/* ---------------- Small helper to read onboarding flag ---------------- */
function isOnboardingDone() {
  try { return localStorage.getItem("onboardingComplete") === "true"; }
  catch { return false; }
}

/* ---------------- App ---------------- */
function AppInner() {
  const location = useLocation();
  const showTabs = true;
  const done = isOnboardingDone();

  // Capture referral code (?ref=XYZ) once
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (!ref) return;

    const newUserId =
      localStorage.getItem("userId") ||
      (() => {
        const id = "u_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("userId", id);
        return id;
      })();

    submitReferralOpen({ code: ref, newUserId }).catch(() => {});
    url.searchParams.delete("ref");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  // ⚡ Varm almindelige “næste skridt” ruter i baggrunden + SFX/voices
  useEffect(() => {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
        const onVoices = () => { try { window.speechSynthesis.getVoices(); } catch {} };
        window.speechSynthesis.onvoiceschanged = onVoices;
      }
    } catch {}

    (async () => {
      try {
        const sfx = await import("./lib/sfx.js");
        sfx.setVolume(0.5);
      } catch {}
    })();

    const idle = (cb) =>
      (window.requestIdleCallback ? window.requestIdleCallback(cb) : setTimeout(cb, 350));
    idle(() => {
  prefetchRoute("/imitate");
  prefetchRoute("/weakness");
  prefetchRoute("/bookmarks");
  prefetchRoute("/settings");
});


    return () => {
      if ("speechSynthesis" in window) {
        try { window.speechSynthesis.onvoiceschanged = null; } catch {}
      }
    };
  }, []);

  // 🔔 Register push notifications on native builds
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let subReg, subErr, subRecv, subAction;
    (async () => {
      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") await PushNotifications.register();
      } catch (e) {
        console.warn("[Push] Permission/register failed:", e);
      }

      subReg = await PushNotifications.addListener("registration", (token) => {
        console.log("[Push] Token:", token?.value);
      });
      subErr = await PushNotifications.addListener("registrationError", (err) =>
        console.warn("[Push] Registration error:", err)
      );
      subRecv = await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => console.log("[Push] Received:", notification)
      );
      subAction = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => console.log("[Push] Action:", action)
      );
    })();

    return () => {
      subReg?.remove?.();
      subErr?.remove?.();
      subRecv?.remove?.();
      subAction?.remove?.();
    };
  }, []);

  return (
    <div className="app-shell">
      <main className="content with-bottom-tabs">
        <Suspense fallback={<div style={{padding:16, color:"var(--muted)"}}>Loading…</div>}>
          <Routes>
            {/* Onboarding always reachable */}
            
            {/* Default route */}
           <Route path="/" element={<Navigate to="/record" replace />} />


            {/* Tabs */}
{TABS.map((t) => (
  <Route key={t.path} path={t.path} element={t.element} />
))}

{/* Feedback (NOT a tab) */}
<Route path="/feedback" element={<Feedback />} />

<Route path="/bookmarks" element={<Bookmarks />} />


            {/* Catch-alls */}
            <Route path="*" element={<Navigate to="/record" replace />} />
          </Routes>
        </Suspense>
      </main>

            {showTabs && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink
              key={t.path}
              to={t.path}
              aria-label={t.label}
              onMouseEnter={() => prefetchRoute(t.path)}
              onTouchStart={() => prefetchRoute(t.path)}
              // 👇 NYT: stempler et "user gesture" tidspunkt for Imitate/Speak
              onClick={() => {
                if (t.path === "/imitate" || t.path === "/speak") {
                  sessionStorage.setItem("ac_last_nav_click", String(Date.now()));
                }
              }}
              className={({ isActive }) => "tabbtn" + (isActive ? " active" : "")}
            >
              <t.Icon className="tabicon" />
              {/* <span className="tablabel">{t.label}</span> */}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </SettingsProvider>
  );
}
