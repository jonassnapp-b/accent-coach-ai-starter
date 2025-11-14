// src/pages/Onboarding.jsx
import React, { useState } from "react";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [accent, setAccent] = useState(null);
  const [level, setLevel] = useState(null);
  const [confidence, setConfidence] = useState(3);

  function saveAndContinue() {
    localStorage.setItem("onboardingAccent", accent);
    localStorage.setItem("onboardingLevel", level);
    localStorage.setItem("onboardingConfidence", confidence);
    localStorage.setItem("onboardingComplete", "true");
    window.location.href = "/record";
  }

  return (
    <div className="page flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to Accent Coach 🎯</h1>

      {step === 1 && (
        <>
          <p className="mb-3">Choose your preferred accent:</p>
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                setAccent("en_us");
                setStep(2);
              }}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white flex items-center gap-2"
            >
              🇺🇸 American
            </button>
            <button
              onClick={() => {
                setAccent("en_br");
                setStep(2);
              }}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white flex items-center gap-2"
            >
              🇬🇧 British
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="mb-3">Select your level:</p>
          <div className="flex gap-3 mb-6">
            {["Easy", "Medium", "Hard"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => {
                  setLevel(lvl.toLowerCase());
                  setStep(3);
                }}
                className="px-4 py-2 rounded-xl bg-blue-500 text-white"
              >
                {lvl}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <p className="mb-3">How confident are you speaking English?</p>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-64 mb-4"
          />
          <div className="mb-4 text-sm text-gray-400">
            Confidence: {confidence}/5
          </div>
          <button
            onClick={saveAndContinue}
            className="px-5 py-2 rounded-xl bg-green-500 text-white shadow-lg"
          >
            Finish 🚀
          </button>
        </>
      )}
    </div>
  );
}