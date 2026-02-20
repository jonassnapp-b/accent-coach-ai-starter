import { NativePurchases } from '@capgo/native-purchases';

const PRODUCT_IDS = [
  'fluentup.pro.monthly',
  'fluentup.pro.yearly'
];

export async function initPurchases() {
  await NativePurchases.initialize({
    debug: true
  });
}

export async function loadProducts() {
  const products = await NativePurchases.getProducts({
    productIdentifiers: PRODUCT_IDS
  });
  return products;
}

export async function buyProduct(productId) {
  const result = await NativePurchases.purchaseProduct({
    productIdentifier: productId
  });
  return result;
}

export async function restorePurchases() {
  return await NativePurchases.restorePurchases();
}
