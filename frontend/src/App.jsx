import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Record from "./pages/Record.jsx";
import Settings from "./pages/Settings.jsx";
import LeaderboardsTab from "./tabs/LeaderboardsTab.jsx";
import "./styles.css";
import LeaderboardsTab from "./tabs/LeaderboardsTab.jsx";

import CoachTab from "./tabs/CoachTab.jsx";
import ProgressTab from "./tabs/ProgressTab.jsx";
import SocialTab from "./tabs/SocialTab.jsx";

const TABS = [
  { path: "/record",   label: "Record",       element: <Record /> },
  { path: "/coach",    label: "Coach",        element: <CoachTab /> },
  { path: "/progress", label: "Progress",     element: <ProgressTab /> },
  { path: "/social",   label: "Social",       element: <SocialTab /> },
  { path: "/leaderboards", label: "Leaderboards", element: <LeaderboardsTab /> },
  { path: "/settings", label: "Settings",     element: <Settings /> },
];


export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="tabs">
          {TABS.map((t) => (
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
          <Routes>
            {/* Default → Record tab */}
            <Route path="/" element={<Navigate to="/record" replace />} />
            {TABS.map((t) => (
              <Route key={t.path} path={t.path} element={t.element} />
            ))}
            {/* Catch-all → Record tab */}
            <Route path="*" element={<Navigate to="/record" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
