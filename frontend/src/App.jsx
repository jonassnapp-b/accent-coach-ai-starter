// src/App.jsx
import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
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
import Onboarding from "./pages/Onboarding.jsx";
import { isOnboardingDone } from "./lib/onboarding.js";

import {
  Mic,
  AudioLines,
  Settings as SettingsIcon,
} from "lucide-react";
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
const ConversationCoach = lazy(() => import("./pages/ConversationCoach.jsx"));
const PracticeMyTextPage = lazy(() => import("./pages/PracticeMyText.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));


import { submitReferralOpen } from "./lib/api.js";

// 🔔 Push (native only)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

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
    "/conversation-coach": () => import("./pages/ConversationCoach.jsx"),
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
async function triggerTabHaptic() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    }

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(20);
    }
  } catch {}
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
  { path: "/conversation-coach", label: "Speak", Icon: AudioLines, element: <ConversationCoach /> },
  { path: "/practice", label: "Practice", Icon: Mic, element: <Practice /> },
  { path: "/settings", label: "Settings", Icon: SettingsIcon, element: <Settings /> },
];











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
const [accentOverlayOpen, setAccentOverlayOpen] = useState(false);
const [conversationCoachFullscreenOpen, setConversationCoachFullscreenOpen] = useState(false);
const location = useLocation();
const navigate = useNavigate();
const contentRef = useRef(null);
const isPaywall = location.pathname === "/pro";
const isOnboardingRoute = location.pathname === "/onboarding";
const isPracticeMyTextRoute =
  location.pathname === "/practice-my-text" ||
  location.pathname === "/coach-my-text";

const [levelOverlayOpen, setLevelOverlayOpen] = useState(false);



const showTabs =
  !scenarioOverlayOpen &&
  !accentOverlayOpen &&
  !levelOverlayOpen &&
  !conversationCoachFullscreenOpen &&
  !isPaywall &&
  !isOnboardingRoute &&
  !isPracticeMyTextRoute;
useEffect(() => {
  const el = contentRef.current;
  if (!el) return;
  el.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, [location.pathname]);
useEffect(() => {
  const onScenario = (e) => setScenarioOverlayOpen(!!e?.detail?.open);
  const onAccent = (e) => setAccentOverlayOpen(!!e?.detail?.open);
  const onLevel = (e) => setLevelOverlayOpen(!!e?.detail?.open);
  const onConversationCoachFullscreen = (e) =>
    setConversationCoachFullscreenOpen(!!e?.detail?.open);

  window.addEventListener("ac:scenarioOverlay", onScenario);
  window.addEventListener("ac:accentOverlay", onAccent);
  window.addEventListener("ac:levelOverlay", onLevel);
  window.addEventListener("ac:conversationCoachFullscreen", onConversationCoachFullscreen);

  return () => {
    window.removeEventListener("ac:scenarioOverlay", onScenario);
    window.removeEventListener("ac:accentOverlay", onAccent);
    window.removeEventListener("ac:levelOverlay", onLevel);
    window.removeEventListener("ac:conversationCoachFullscreen", onConversationCoachFullscreen);
  };
}, []);
useEffect(() => {
  if (showSplash) return;
  if (!isOnboardingDone()) return;

  const allowedPaths = [
    "/conversation-coach",
    "/practice",
    "/settings",
    "/coach",
    "/ai-chat",
    "/imitate",
    "/feedback",
    "/record",
    "/practice-my-text",
    "/coach-my-text",
    "/weakness",
    "/bookmarks",
    "/terms",
    "/privacy",
    "/pro",
  ];

  if (!allowedPaths.includes(location.pathname)) {
    navigate("/conversation-coach", { replace: true });
    return;
  }

  if (location.pathname === "/") {
    navigate("/conversation-coach", { replace: true });
  }
}, [showSplash, location.pathname, navigate]);
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
  prefetchRoute("/conversation-coach");
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
          

          <main ref={contentRef} className="content with-bottom-tabs">
            <Suspense fallback={<div style={{padding:16, color:"var(--muted)"}}>Loading…</div>}>
              <Routes>
               <Route
  path="/"
  element={
    isOnboardingDone()
      ? <Navigate to="/conversation-coach" replace />
      : <Navigate to="/onboarding" replace />
  }
/>

<Route
  path="/onboarding"
  element={
    isOnboardingDone()
      ? <Navigate to="/conversation-coach" replace />
      : <Onboarding />
  }
/>
            {TABS.map((t) => (
  <Route key={t.path} path={t.path} element={t.element} />
))}

<Route path="/coach" element={<Coach />} />
<Route path="/ai-chat" element={<AiChat />} />

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
  triggerTabHaptic();

  if (location.pathname === t.path) {
    window.dispatchEvent(
      new CustomEvent("ac:tabReselect", { detail: { path: t.path } })
    );
  }

  if (t.path === "/coach") {
    sessionStorage.setItem("ac_last_nav_click", String(Date.now()));
  }
}}
  className={({ isActive }) => "tabbtn" + (isActive ? " active" : "")}
>
<t.Icon className="tabicon" size={24} strokeWidth={2.2} />  
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



