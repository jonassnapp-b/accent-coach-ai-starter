// src/components/SplashSequence.jsx
import { useEffect } from "react";
import logoArrow from "../assets/logo-arrow-hq.png";

export default function SplashSequence({ onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 2300);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#ffffff",
        display: "grid",
        placeItems: "center",
      }}
    >
   <img
  src={logoArrow}
  alt=""
  style={{ width: "80vw", maxWidth: 520, height: "auto" }}
/>
    </div>
  );
}
