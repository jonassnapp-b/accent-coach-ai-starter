import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { PostHogProvider } from "@posthog/react";
window.__FE_BUILD_STAMP__ = "2026-02-25T16:00Z_v1";

try {
  const k = "ac_fe_build_stamp";
  const prev = localStorage.getItem(k);

  console.log("[BUILD] FE_BUILD_STAMP", { prev, cur: window.__FE_BUILD_STAMP__ });

  if (prev !== window.__FE_BUILD_STAMP__) {
    console.log("[BUILD] FE_BUILD_STAMP changed → clearing storage");
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, window.__FE_BUILD_STAMP__);
  } else {
    console.log("[BUILD] FE_BUILD_STAMP unchanged");
  }
} catch {}



if (!import.meta.env.DEV && false) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}


function ErrorBoundary({ children }) {
  try {
    return children;
  } catch (e) {
    return <pre style={{ padding: 16 }}>{String(e)}</pre>;
  }
}


const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  capture_pageview: true,
  capture_pageleave: true,
  session_recording: { enabled: false }, // vi holder replay fra for nu
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={posthogOptions}
    >
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>
);

