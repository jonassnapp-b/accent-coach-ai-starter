// src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";

import Record from "./pages/Record.jsx";
import Imitate from "./pages/Imitate.jsx";                 // ⟵ NY
import SpeakAlong from "./pages/SpeakAlong.jsx";
import Settings from "./pages/Settings.jsx";
import "./styles.css";

const TABS = [
  { path: "/record",       label: "RECORD",       element: <Record /> },
  { path: "/imitate",      label: "IMITATE",      element: <Imitate /> },       // hvis ikke allerede
  { path: "/speak", label: "SPEAK ALONG", element: <SpeakAlong /> },
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
            <Route path="/" element={<Navigate to="/record" replace />} />
            {TABS.map(t => (
              <Route key={t.path} path={t.path} element={t.element} />
            ))}
            {/* Catch-all -> LEARN */}
            <Route path="*" element={<Navigate to="/record" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
