import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { PostHogProvider } from "@posthog/react";

console.log("[BUILD] FE_BUILD_STAMP=2026-02-25T15:49Z_v1");

try {
  const k = "ac_fe_build_stamp_v1";
  const cur = "2026-02-25T15:49Z_v1";
  const prev = localStorage.getItem(k);

  if (prev !== cur) {
    console.log("[BUILD] FE_BUILD_STAMP changed → clearing storage", { prev, cur });
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(k, cur);
  } else {
    console.log("[BUILD] FE_BUILD_STAMP unchanged", cur);
  }
} catch (e) {
  console.log("[BUILD] FE_BUILD_STAMP storage check failed", e);
}
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

