export default function Privacy() {
  return (
    <div style={{ padding: 18, maxWidth: 720, margin: "0 auto", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>Account or device identifiers</li>
        <li>Speech recordings (for pronunciation analysis)</li>
        <li>App usage analytics</li>
        <li>Subscription status</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li>To provide speech analysis and feedback</li>
        <li>To improve the app experience</li>
        <li>To process subscriptions and payments</li>
        <li>To analyze performance and fix bugs</li>
      </ul>

      <h2>3. Speech Recordings</h2>
      <p>
        Audio recordings are used solely for pronunciation analysis.
        Recordings may be processed by secure third-party services.
        We do not sell your audio data.
      </p>

      <h2>4. Analytics</h2>
      <p>
        We may use analytics tools to understand how users interact with the app.
        This data is anonymized where possible.
      </p>

      <h2>5. Data Storage & Security</h2>
      <p>
        We take reasonable measures to protect your data.
        However, no system can guarantee absolute security.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You may request deletion of your data by contacting us at
        admin@fluentup.app.
      </p>

      <h2>7. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time.
        Continued use of the app indicates acceptance of changes.
      </p>

      <h2>8. Contact</h2>
      <p>
        If you have questions about this Privacy Policy, contact:
        admin@fluentup.app
      </p>
    </div>
  );
}