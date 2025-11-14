import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function ErrorBoundary({ children }) {
  try {
    return children;
  } catch (e) {
    return <pre style={{ padding: 16 }}>{String(e)}</pre>;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
