import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, SignIn, SignUp } from "@clerk/clerk-react";

function Home() {
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Accent Coach AI</h1>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <SignedOut>
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 10 }}>
          <h2>Login påkrævet</h2>
          <p>Brug Google eller Apple til at logge ind.</p>
          <Link
            to="/sign-in"
            style={{
              display: "inline-block",
              background: "#3b82f6",
              color: "white",
              padding: "10px 14px",
              borderRadius: 8,
              textDecoration: "none",
              marginTop: 8,
            }}
          >
            Gå til login
          </Link>
        </div>
      </SignedOut>

      <SignedIn>
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 10 }}>
          <h2>Du er logget ind ✔</h2>
          <p>Her kan du placere resten af din app (faner, optagelse, feedback osv.).</p>
          {/* >>> Flyt/indsæt dit eksisterende indhold herinde <<< */}
        </div>
      </SignedIn>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Forside */}
      <Route path="/" element={<Home />} />

      {/* Clerk sider (vigtigt: brug /* så Clerk kan lave interne subroutes) */}
      <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
      <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />

      {/* Fallback – send alt andet til Home (kræver vercel.json fallback, som du lavede) */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
