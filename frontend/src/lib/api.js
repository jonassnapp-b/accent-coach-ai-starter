// src/App.jsx
import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Record from "./pages/Record.jsx";
import Settings from "./pages/Settings.jsx"; // hvis du har den – ellers fjern ruten
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="tabs">
          <NavLink to="/record" className={({isActive}) => isActive ? "tab active" : "tab"}>
            Record
          </NavLink>
          {/* Fjernet: Feedback-tab */}
          <NavLink to="/settings" className={({isActive}) => isActive ? "tab active" : "tab"}>
            Settings
          </NavLink>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/record" replace />} />
            <Route path="/record" element={<Record />} />
            {/* Fjernet: <Route path="/feedback" element={<Feedback />} /> */}
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/record" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
