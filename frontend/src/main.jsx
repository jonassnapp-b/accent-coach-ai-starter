import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { PostHogProvider } from "@posthog/react";

if (!import.meta.env.DEV) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // behold warnings/errors (vil du også fjerne dem, så sig til)
}


function ErrorBoundary({ children }) {
  try {
    return children;
  } catch (e) {
    return <pre style={{ padding: 16 }}>{String(e)}</pre>;
  }
}
console.log("POSTHOG KEY:", import.meta.env.VITE_PUBLIC_POSTHOG_KEY);
console.log("POSTHOG HOST:", import.meta.env.VITE_PUBLIC_POSTHOG_HOST);

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  capture_pageview: false,
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

