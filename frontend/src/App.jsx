import React from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

export default function App() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>Accent Coach AI</div>
        <div style={styles.headerRight}>
          {/* When the user is signed in, show their avatar */}
          <SignedIn>
            <UserButton />
          </SignedIn>

          {/* When the user is signed out, show the sign-in button (modal) */}
          <SignedOut>
            <SignInButton mode="modal">
              <button style={styles.primaryBtn}>Continue with Google / Apple</button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      {/* Content gate: only show the app when signed in */}
      <main style={styles.main}>
        <SignedOut>
          <div style={styles.card}>
            <h2 style={styles.title}>Sign in required</h2>
            <p style={styles.p}>
              Click the button below to sign in with Google or Apple.
            </p>
            <SignInButton mode="modal">
              <button style={styles.primaryBtnLarge}>Continue with Google / Apple</button>
            </SignInButton>

            <p style={{ ...styles.p, marginTop: 14, opacity: 0.7 }}>
              Tip: We use a popup modal, so you don’t need a <code>/sign-in</code> route.
            </p>
          </div>
        </SignedOut>

        <SignedIn>
          <AppContent />
        </SignedIn>
      </main>

      <footer style={styles.footer}>
        <span style={{ opacity: 0.7 }}>MVP</span>
      </footer>
    </div>
  );
}

/**
 * Put your actual app UI here.
 * For now it’s a simple placeholder so you can confirm sign-in works.
 * You can replace the inside of <AppContent /> later with your full UI.
 */
function AppContent() {
  const { user } = useUser();
  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Welcome{user?.firstName ? `, ${user.firstName}` : ""}!</h2>
      <p style={styles.p}>
        You’re signed in. Replace this box with your existing app interface when you’re ready.
      </p>

      {/* EXAMPLE: target phrase + analyze button (dummy) */}
      <div style={{ marginTop: 12 }}>
        <label style={styles.label}>Target phrase</label>
        <textarea
          defaultValue="The quick brown fox jumps over the lazy dog."
          style={styles.textarea}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={styles.primaryBtn}>Analyze</button>
          <button style={styles.secondaryBtn}>Reset</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Inline styles so you don’t have to manage CSS files ===== */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#fafafa",
    color: "#111",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    height: 64,
    padding: "0 16px",
    borderBottom: "1px solid #eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  brand: { fontWeight: 700, fontSize: 18 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 16,
  },
  footer: {
    padding: 12,
    borderTop: "1px solid #eee",
    textAlign: "center",
    background: "#fff",
  },
  card: {
    width: "100%",
    maxWidth: 760,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  title: { margin: 0, marginBottom: 8, fontSize: 20 },
  p: { margin: 0, marginTop: 6, lineHeight: 1.4 },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: "#444",
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    resize: "vertical",
  },
  primaryBtn: {
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #1f6feb",
    background: "#1f6feb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  primaryBtnLarge: {
    height: 42,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #1f6feb",
    background: "#1f6feb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryBtn: {
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
  },
};
