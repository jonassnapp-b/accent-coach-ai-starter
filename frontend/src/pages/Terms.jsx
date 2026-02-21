import { useNavigate } from "react-router-dom";

export default function Terms() {
    const nav = useNavigate();
  return (
    <div style={{ padding: 18, maxWidth: 720, margin: "0 auto", lineHeight: 1.6 }}>
        <button
  onClick={() => nav(-1)}
  style={{
    border: "none",
    background: "transparent",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
    marginBottom: 12,
    padding: 0,
  }}
>
  ← Back
</button>
      <h1>Terms of Service</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>

      <h2>1. Overview</h2>
      <p>
        Welcome to FluentUp ("the App"), operated by FluentUp.
        By using this app, you agree to these Terms of Service.
        If you do not agree, please do not use the app.
      </p>

      <h2>2. Subscriptions & Billing</h2>
      <p>
        FluentUp offers optional paid subscriptions that provide access to
        premium features.
      </p>
      <ul>
        <li>Subscriptions renew automatically unless cancelled.</li>
        <li>You may cancel at any time in your Apple App Store or Google Play settings.</li>
        <li>Payment is charged through your App Store account.</li>
        <li>No refunds are provided except as required by law.</li>
      </ul>

      <h2>3. Free Trial</h2>
      <p>
        If a free trial is offered, you will not be charged during the trial period.
        After the trial ends, your subscription will begin automatically unless cancelled
        at least 24 hours before the trial ends.
      </p>

      <h2>4. Acceptable Use</h2>
      <p>
        You agree not to misuse the app, attempt to reverse engineer it,
        or use it in any unlawful way.
      </p>

      <h2>5. AI & Speech Analysis</h2>
      <p>
        The app provides speech analysis and AI-generated feedback.
        Results are for educational purposes only and may not be perfectly accurate.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        The app is provided “as is” without warranties of any kind.
        FluentUp is not liable for any indirect or consequential damages.
      </p>

      <h2>7. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time.
        Continued use of the app means you accept the updated terms.
      </p>

      <h2>8. Contact</h2>
      <p>
        If you have questions, contact us at: admin@fluentup.app
      </p>
    </div>
  );
}