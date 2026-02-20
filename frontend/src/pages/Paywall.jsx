import { useEffect, useState } from "react";
import { initPurchases, loadProducts, buyProduct, restorePurchases } from "../lib/purchases";

export default function Paywall() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function setup() {
      setStatus("Loading…");

      // optional: if you have an API key, pass it here
      await initPurchases({ apiKey: "" });

      const items = await loadProducts();
      setProducts(items);
      setStatus(items?.length ? "" : "No products loaded (check App Store Connect product IDs/offering).");
    }
    setup();
  }, []);

  async function handleBuy(id) {
    const out = await buyProduct(id);

    if (!out?.ok) {
      alert(`Purchase failed: ${out?.reason || "unknown"}${out?.error ? "\n" + out.error : ""}`);
      return;
    }

    // TODO: replace this with real entitlement check
    localStorage.setItem("isPro", "true");
    alert("Unlocked Pro 🎉");
  }

  async function handleRestore() {
    const out = await restorePurchases();

    if (!out?.ok) {
      alert(`Restore failed: ${out?.reason || "unknown"}${out?.error ? "\n" + out.error : ""}`);
      return;
    }

    // TODO: replace this with real entitlement check
    localStorage.setItem("isPro", "true");
    alert("Restored ✅");
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Go Pro</h1>

      {!!status && <div style={{ marginTop: 8, opacity: 0.7 }}>{status}</div>}

      {products.map((p) => (
        <div key={p.productIdentifier} style={{ marginTop: 12 }}>
          <h3>{p.title}</h3>
          <p>{p.price}</p>
          <button onClick={() => handleBuy(p.productIdentifier)}>Buy</button>
        </div>
      ))}

      <button style={{ marginTop: 18 }} onClick={handleRestore}>
        Restore Purchases
      </button>
    </div>
  );
}
