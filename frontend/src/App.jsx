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

// Lazy-load sider der er tungere
const Imitate    = lazy(() => import("./pages/Imitate.jsx"));
const SpeakAlong = lazy(() => import("./pages/SpeakAlong.jsx"));
const Settings   = lazy(() => import("./pages/Settings.jsx"));
const Bookmarks  = lazy(() => import("./pages/Bookmarks.jsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.jsx"));

import iconRecord   from "./assets/tabs/record.png";
import iconImitate  from "./assets/tabs/imitate.png";
import iconSpeak    from "./assets/tabs/speak.png";
import iconSettings from "./assets/tabs/settings.png";

import { submitReferralOpen } from "./lib/api.js";

// 🔔 Push (native only)
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

import "./styles.css";

/* ---------------- Prefetch helpers (route-level) ---------------- */
const routePrefetch = {
  "/imitate":    () => import("./pages/Imitate.jsx"),
  "/speak":      () => import("./pages/SpeakAlong.jsx"),
  "/settings":   () => import("./pages/Settings.jsx"),
  "/bookmarks":  () => import("./pages/Bookmarks.jsx"),
  "/onboarding": () => import("./pages/Onboarding.jsx"),
};
function prefetchRoute(path) {
  try { routePrefetch[path]?.(); } catch {}
}

/* ---------------- Tabs ---------------- */
const TABS = [
  { path: "/record",   label: "Record",      icon: iconRecord,   element: <Record /> },
  { path: "/imitate",  label: "Imitate",     icon: iconImitate,  element: <Imitate /> },
  { path: "/speak",    label: "Speak Along", icon: iconSpeak,    element: <SpeakAlong /> },
  { path: "/settings", label: "Settings",    icon: iconSettings, element: <Settings /> },
];

/* ---------------- Small helper to read onboarding flag ---------------- */
function isOnboardingDone() {
  try { return localStorage.getItem("onboardingComplete") === "true"; }
  catch { return false; }
}

/* ---------------- App ---------------- */
function AppInner() {
  const location = useLocation();
  const showTabs = location.pathname !== "/onboarding";
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
      prefetchRoute("/speak");
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
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Default route */}
            <Route
              path="/"
              element={<Navigate to={done ? "/record" : "/onboarding"} replace />}
            />

            {/* Tabs */}
            {TABS.map((t) => (
              <Route key={t.path} path={t.path} element={t.element} />
            ))}

            <Route path="/bookmarks" element={<Bookmarks />} />

            {/* Catch-alls */}
            {!done && <Route path="*" element={<Navigate to="/onboarding" replace />} />}
            {done && <Route path="*" element={<Navigate to="/record" replace />} />}
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
              <img src={t.icon} alt="" className="tabicon" />
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