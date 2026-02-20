// frontend/src/lib/purchases.js

function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}

let _nativePurchasesPromise = null;

async function getNativePurchases() {
  if (!isNative()) return null;

  // Lazy-import ONLY on native, so Vite/Rollup web build doesn't need the module
  if (!_nativePurchasesPromise) {
    const moduleName = "@capgo/native-purchases";
_nativePurchasesPromise = import(/* @vite-ignore */ moduleName).catch(() => null);
  }

  const mod = await _nativePurchasesPromise;
  // Capgo exports can vary; try common shapes safely
  return mod?.Purchases || mod?.default?.Purchases || mod?.default || mod || null;
}

/**
 * Optional: call this once on app start (native only)
 */
export async function purchasesConfigure({ apiKey } = {}) {
  const Purchases = await getNativePurchases();
  if (!Purchases) return { ok: false, reason: "not_native" };

  // Adjust if your plugin uses different method names
  if (apiKey && Purchases.configure) {
    await Purchases.configure({ apiKey });
  }
  return { ok: true };
}

export async function purchasesGetOfferings() {
  const Purchases = await getNativePurchases();
  if (!Purchases) return null;
  if (!Purchases.getOfferings) return null;
  return Purchases.getOfferings();
}

export async function purchasesPurchaseProduct(productId) {
  const Purchases = await getNativePurchases();
  if (!Purchases) return { ok: false, reason: "not_native" };
  if (!Purchases.purchaseProduct) return { ok: false, reason: "missing_method" };

  const res = await Purchases.purchaseProduct({ productIdentifier: productId });
  return { ok: true, res };
}

export async function purchasesRestore() {
  const Purchases = await getNativePurchases();
  if (!Purchases) return { ok: false, reason: "not_native" };
  if (!Purchases.restorePurchases) return { ok: false, reason: "missing_method" };

  const res = await Purchases.restorePurchases();
  return { ok: true, res };
}

export async function purchasesGetCustomerInfo() {
  const Purchases = await getNativePurchases();
  if (!Purchases) return null;
  if (!Purchases.getCustomerInfo) return null;
  return Purchases.getCustomerInfo();
}
