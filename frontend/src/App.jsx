// src/App.jsx
import React, { useEffect, useState, Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { SettingsProvider } from "./lib/settings-store.jsx";

import Record from "./pages/Record.jsx";
import Feedback from "./pages/Feedback.jsx";

import { Mic, AudioWaveform, Settings as SettingsIcon, MessageCircle } from "lucide-react";
import SplashSequence from "./components/SplashSequence";
import { usePostHog } from "@posthog/react";
import Paywall from "./pages/Paywall.jsx";
import { PurchasesProvider } from "./providers/PurchasesProvider.jsx";



// Lazy-load sider der er tungere
const ProgressiveSentenceMastery = lazy(() => import("./pages/ProgressiveSentenceMastery.jsx"));
const WeaknessLab = lazy(() => import("./pages/WeaknessLab.jsx"));
const Settings   = lazy(() => import("./pages/Settings.jsx"));
const Bookmarks  = lazy(() => import("./pages/Bookmarks.jsx"));
const Coach = lazy(() => import("./pages/Coach.jsx"));
const AiChat = lazy(() => import("./pages/AiChat.jsx"));
const Practice = lazy(() => import("./pages/Practice.jsx"));
const PracticeMyTextPage = lazy(() => import("./pages/PracticeMyText.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));


import { submitReferralOpen } from "./lib/api.js";

// 🔔 Push (native only)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import "./styles.css";
/* ---------------- Backend warm-up (Render cold start) ---------------- */
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}

function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    return base; // may be ""
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}

const BACKEND_WARM_KEY = "ac_backend_warm_v1";

function warmBackendOnce() {
  try {
    if (sessionStorage.getItem(BACKEND_WARM_KEY) === "1") return;
    sessionStorage.setItem(BACKEND_WARM_KEY, "1");
  } catch {}

  const base = getApiBase();
  if (!base) return;

  // Fire-and-forget. No UI. No timeout. No await.
  try { fetch(`${base}/api/health`, { cache: "no-store" }).catch(() => {}); } catch {}
  try { fetch(`${base}/api/ping`,   { cache: "no-store" }).catch(() => {}); } catch {}
}

/* ---------------- Prefetch helpers (route-level) ---------------- */
const routePrefetch = {
  "/ai-chat":   () => import("./pages/AiChat.jsx"),
  "/coach":     () => import("./pages/Coach.jsx"),
  "/practice":  () => import("./pages/Practice.jsx"),
    "/practice-my-text": () => import("./pages/PracticeMyText.jsx"),
      "/coach-my-text":    () => import("./pages/PracticeMyText.jsx"),

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
  { path: "/ai-chat",  label: "Scenarios",  Icon: MessageCircle, element: <AiChat /> },
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
  console.log("APPINNER LOADED", window.location.href);

    const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("app_open");
  }, [posthog]);

  const [showSplash, setShowSplash] = useState(() => {
  try { return sessionStorage.getItem("ac_splash_done_v1") !== "1"; }
  catch { return true; }
});
useEffect(() => {
  if (showSplash) return;

  const idle = (cb) =>
    (window.requestIdleCallback ? window.requestIdleCallback(cb) : setTimeout(cb, 350));

  idle(() => warmBackendOnce());
}, [showSplash]);

    
  const [scenarioOverlayOpen, setScenarioOverlayOpen] = useState(false);
const location = useLocation();
const isPaywall = location.pathname === "/pro";
const showTabs = !scenarioOverlayOpen && !isPaywall;

useEffect(() => {
  const on = (e) => setScenarioOverlayOpen(!!e?.detail?.open);
  window.addEventListener("ac:scenarioOverlay", on);
  return () => window.removeEventListener("ac:scenarioOverlay", on);
}, []);
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
    <>
      {showSplash && (
        <SplashSequence
  onDone={() => {
    try { sessionStorage.setItem("ac_splash_done_v1", "1"); } catch {}
    setShowSplash(false);
  }}
/>
      )}

      {!showSplash && (
        <div className="app-shell">
          

          <main className="content with-bottom-tabs">
            <Suspense fallback={<div style={{padding:16, color:"var(--muted)"}}>Loading…</div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/ai-chat" replace />} />

                {TABS.map((t) => (
                  <Route key={t.path} path={t.path} element={t.element} />
                ))}

                <Route path="/imitate" element={<ProgressiveSentenceMastery />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/record" element={<PracticeGate />} />
                <Route path="/practice-my-text" element={<PracticeMyTextPage />} />
                <Route path="/coach-my-text" element={<PracticeMyTextPage />} />
                <Route path="/weakness" element={<WeaknessLab />} />
                <Route path="/bookmarks" element={<Bookmarks />} />
                <Route path="/terms" element={<Terms />} />
<Route path="/privacy" element={<Privacy />} />
               <Route path="/pro" element={<Paywall />} />
                <Route path="*" element={<div />} />
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
  <t.Icon className="tabicon" />
  <div className="tablabel">{t.label}</div>
</NavLink>

              ))}
            </nav>
          )}
        </div>
      )}
    </>
  );

}

export default function App() {
  return (
    <SettingsProvider>
      <PurchasesProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </PurchasesProvider>
    </SettingsProvider>
  );
}



