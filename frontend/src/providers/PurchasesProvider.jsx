// src/providers/PurchasesProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  initPurchases,
  loadProducts,
  buyProduct,
  restorePurchases,
  getProStatus,
} from "../lib/purchases";

const Ctx = createContext(null);

export function PurchasesProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [isPro, setIsPro] = useState(false);
  const [activeProductIds, setActiveProductIds] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [lastAction, setLastAction] = useState(null); // til diagnostics

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  async function refreshAll() {
    if (!isNative) {
      setLoading(false);
      setProducts([]);
      setIsPro(false);
      setActiveProductIds([]);
      return;
    }

    setLoading(true);
    setLastError(null);

    try {
      const init = await initPurchases();
      if (init?.ok === false) throw new Error(`init failed: ${init.reason}`);

      const [pro, pro2, items] = await Promise.all([
        getProStatus(), // { isPro, activeProductIds }
        getProStatus(), // dobbelt er ikke nødvendigt; holdt her som placeholder? -> vi fjerner
        loadProducts(),
      ]);
      // (vi bruger kun én)
      setProducts(items || []);
      setIsPro(!!pro?.isPro);
      setActiveProductIds(pro?.activeProductIds || []);

      setLastAction({
        type: "refresh",
        at: Date.now(),
        init,
        productsCount: (items || []).length,
        isPro: !!pro?.isPro,
        activeProductIds: pro?.activeProductIds || [],
      });
    } catch (e) {
      setLastError(String(e?.message ?? e));
      setLastAction({ type: "refresh_error", at: Date.now(), error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  // fix: remove duplicate getProStatus call
  async function refreshAllFixed() {
    if (!isNative) {
      setLoading(false);
      setProducts([]);
      setIsPro(false);
      setActiveProductIds([]);
      return;
    }

    setLoading(true);
    setLastError(null);

    try {
      const init = await initPurchases();
      if (init?.ok === false) throw new Error(`init failed: ${init.reason}`);

      const [pro, items] = await Promise.all([getProStatus(), loadProducts()]);

      setProducts(items || []);
      setIsPro(!!pro?.isPro);
      setActiveProductIds(pro?.activeProductIds || []);

      setLastAction({
        type: "refresh",
        at: Date.now(),
        init,
        productsCount: (items || []).length,
        isPro: !!pro?.isPro,
        activeProductIds: pro?.activeProductIds || [],
      });
    } catch (e) {
      setLastError(String(e?.message ?? e));
      setLastAction({ type: "refresh_error", at: Date.now(), error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAllFixed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  async function buy(planId) {
    // planId = product id string
    setLoading(true);
    setLastError(null);

    try {
      const out = await buyProduct(planId);

      setLastAction({ type: "purchase", at: Date.now(), productId: planId, out });

      if (!out?.ok) {
        // cancelled skal ikke være “error UI”
        if (out?.reason === "cancelled") return;
        throw new Error(out?.error || out?.reason || "purchase_failed");
      }

      // Efter køb: refresh entitlement fra StoreKit (ikke localStorage)
      const pro = await getProStatus();
      setIsPro(!!pro?.isPro);
      setActiveProductIds(pro?.activeProductIds || []);
    } catch (e) {
      setLastError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function restore() {
    setLoading(true);
    setLastError(null);

    try {
      const out = await restorePurchases();
      setLastAction({ type: "restore", at: Date.now(), out });

      if (!out?.ok) throw new Error(out?.error || out?.reason || "restore_failed");

      const pro = await getProStatus();
      setIsPro(!!pro?.isPro);
      setActiveProductIds(pro?.activeProductIds || []);
    } catch (e) {
      setLastError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const value = useMemo(
    () => ({
      isNative,
      loading,
      products,
      isPro,
      activeProductIds,
      lastError,
      lastAction,
      refresh: refreshAllFixed,
      buy,
      restore,
    }),
    [isNative, loading, products, isPro, activeProductIds, lastError, lastAction]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePurchases() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePurchases must be used within PurchasesProvider");
  return v;
}

export function useProStatus() {
  const { isPro, loading } = usePurchases();
  return { isPro, loading };
}
