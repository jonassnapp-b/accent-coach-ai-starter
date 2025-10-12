// src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";

import LearnTab from "./tabs/LearnTab.jsx";
import Record from "./pages/Record.jsx";
import Settings from "./pages/Settings.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import LeaderboardsTab from "./tabs/LeaderboardsTab.jsx";
import "./styles.css";

// Social/Coach er væk – LEARN er ny “forside”
const TABS = [
  { path: "/learn",        label: "LEARN",        element: <LearnTab /> },
  { path: "/record",       label: "RECORD",       element: <Record /> },
  { path: "/progress",     label: "PROGRESS",     element: <ProgressTab /> },
  { path: "/leaderboards", label: "LEADERBOARDS", element: <LeaderboardsTab /> },
  { path: "/settings",     label: "SETTINGS",     element: <Settings /> },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="tabs">
          {TABS.map(t => (
            <NavLink
              key={t.path}
              to={t.path}
              className={({ isActive }) => (isActive ? "tab active" : "tab")}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <main className="content">
          {/* Default -> LEARN */}
          <Routes>
            <Route path="/" element={<Navigate to="/learn" replace />} />
            {TABS.map(t => (
              <Route key={t.path} path={t.path} element={t.element} />
            ))}
            {/* Catch-all -> LEARN */}
            <Route path="*" element={<Navigate to="/learn" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
