import { useEffect, useState } from "react";
import {
  purchasesConfigure,
  purchasesGetOfferings,
  purchasesPurchaseProduct,
  purchasesRestore,
} from "../lib/purchases";

export default function Paywall() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function setup() {
      // Only does something on native; safe on web
      await purchasesConfigure();

      const offerings = await purchasesGetOfferings();

      // Make this resilient, because offerings shape can vary
      const items =
        offerings?.current?.availablePackages ||
        offerings?.current?.packages ||
        offerings?.availablePackages ||
        offerings?.packages ||
        [];

      setProducts(items);
    }
    setup();
  }, []);

  async function handleBuy(productId) {
    const out = await purchasesPurchaseProduct(productId);

    if (out?.ok) {
      localStorage.setItem("isPro", "true");
      alert("Unlocked Pro 🎉");
    } else {
      alert("Purchase failed / not available (web build).");
    }
  }

  async function handleRestore() {
    const out = await purchasesRestore();
    if (out?.ok) {
      alert("Restored ✅");
    } else {
      alert("Restore failed / not available (web build).");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Go Pro</h1>

      {products.map((p, idx) => {
        // Some SDKs have productIdentifier on the product,
        // others have it on package.product
        const prod =
          p?.product ||
          p?.productIdentifier
            ? p
            : null;

        const productIdentifier =
          p?.productIdentifier ||
          prod?.productIdentifier ||
          p?.identifier ||
          prod?.identifier ||
          `pkg_${idx}`;

        const title =
          p?.product?.title ||
          p?.title ||
          "Pro";

        const price =
          p?.product?.priceString ||
          p?.priceString ||
          p?.product?.price ||
          p?.price ||
          "";

        return (
          <div key={productIdentifier} style={{ marginBottom: 12 }}>
            <h3>{title}</h3>
            <p>{price}</p>
            <button onClick={() => handleBuy(productIdentifier)}>
              Buy
            </button>
          </div>
        );
      })}

      <button onClick={handleRestore}>
        Restore Purchases
      </button>
    </div>
  );
}
