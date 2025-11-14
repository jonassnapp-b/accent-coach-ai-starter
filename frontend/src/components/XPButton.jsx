// src/components/XPButton.jsx
import React from "react";
import { motion } from "framer-motion";

export default function XPButton({
  children,
  onClick,
  disabled = false,
  className = "",
}) {
  return (
    <div className={"xp-wrap" + (disabled ? " is-disabled" : "")}>
      {/* sprinkles */}
      <span className="xp-sparkle tl" />
      <span className="xp-sparkle tr" />
      <span className="xp-sparkle bl" />
      <span className="xp-sparkle br" />
      <motion.button
        type="button"
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={"xp-btn " + className}
      >
        <span className="xp-inner">{children}</span>
      </motion.button>
    </div>
  );
}
