import { useEffect, useState } from 'react';
import {
  initPurchases,
  loadProducts,
  buyProduct,
  restorePurchases
} from '../lib/purchases';

export default function Paywall() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function setup() {
      await initPurchases();
      const items = await loadProducts();
      setProducts(items);
    }
    setup();
  }, []);

  async function handleBuy(id) {
    const res = await buyProduct(id);

    if (res?.transactions?.length > 0) {
      localStorage.setItem('isPro', 'true');
      alert('Unlocked Pro 🎉');
    }
  }

  return (
    <div>
      <h1>Go Pro</h1>

      {products.map(p => (
        <div key={p.productIdentifier}>
          <h3>{p.title}</h3>
          <p>{p.price}</p>
          <button onClick={() => handleBuy(p.productIdentifier)}>
            Buy
          </button>
        </div>
      ))}

      <button onClick={restorePurchases}>
        Restore Purchases
      </button>
    </div>
  );
}
