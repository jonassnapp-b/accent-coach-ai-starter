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
import { Mic, AudioWaveform, Target, Settings as SettingsIcon, MessageCircle } from "lucide-react";



// Lazy-load sider der er tungere
const ProgressiveSentenceMastery = lazy(() => import("./pages/ProgressiveSentenceMastery.jsx"));
const WeaknessLab = lazy(() => import("./pages/WeaknessLab.jsx"));
const Settings   = lazy(() => import("./pages/Settings.jsx"));
const Bookmarks  = lazy(() => import("./pages/Bookmarks.jsx"));
const Coach = lazy(() => import("./pages/Coach.jsx"));
const AiChat = lazy(() => import("./pages/AiChat.jsx"));
const Practice = lazy(() => import("./pages/Practice.jsx"));


import { submitReferralOpen } from "./lib/api.js";

// 🔔 Push (native only)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import "./styles.css";

/* ---------------- Prefetch helpers (route-level) ---------------- */
const routePrefetch = {
  "/ai-chat":   () => import("./pages/AiChat.jsx"),
  "/coach":     () => import("./pages/Coach.jsx"),
  "/practice":  () => import("./pages/Practice.jsx"),
  "/imitate":   () => import("./pages/ProgressiveSentenceMastery.jsx"),
  "/weakness":  () => import("./pages/WeaknessLab.jsx"),
  "/bookmarks": () => import("./pages/Bookmarks.jsx"),
  "/settings":  () => import("./pages/Settings.jsx"),
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
  { path: "/coach",    label: "Talk",     Icon: AudioWaveform, element: <Coach /> },
  { path: "/practice", label: "Practice", Icon: Mic,           element: <Practice /> },
  { path: "/settings", label: "Settings", Icon: SettingsIcon,  element: <Settings /> },
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
        prefetchRoute("/ai-chat");

        prefetchRoute("/coach");
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
           <Route path="/" element={<Navigate to="/practice" replace />} />


            {/* Tabs */}
{TABS.map((t) => (
  <Route key={t.path} path={t.path} element={t.element} />
))}
<Route path="/ai-chat" element={<AiChat />} />

{/* Hidden route (NOT a tab) */}
<Route path="/imitate" element={<ProgressiveSentenceMastery />} />

{/* Feedback (NOT a tab) */}
<Route path="/feedback" element={<Feedback />} />
{/* Hidden routes (NOT tabs) */}
<Route path="/record" element={<PracticeGate />} />
<Route path="/weakness" element={<WeaknessLab />} />
<Route path="/bookmarks" element={<Bookmarks />} />


            {/* Catch-alls */}
            <Route path="*" element={<Navigate to="/practice" replace />} />
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
  onClick={() => {
    if (t.path === "/coach") {
      sessionStorage.setItem("ac_last_nav_click", String(Date.now()));
    }
  }}
  className={({ isActive }) => "tabbtn" + (isActive ? " active" : "")}
>
{({ isActive }) =>
  t.path === "/settings" ? (
    <svg
      className="tabicon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ fill: isActive ? "#2196F3" : "currentColor" }}
    >
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
    </svg>
  ) : (
    <t.Icon
      className="tabicon"
      fill="none"
      stroke={isActive ? "#2196F3" : "currentColor"}
      strokeWidth={2}
    />
  )
}



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
