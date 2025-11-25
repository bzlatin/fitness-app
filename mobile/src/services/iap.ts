import { Platform } from "react-native";
import { PlanChoice, validateIosReceipt } from "../api/subscriptions";

const productIds: Record<PlanChoice, string> = {
  monthly: "pro_monthly_subscription",
  annual: "pro_annual_subscription",
};

const log = (...args: unknown[]) => {
  // Centralized logging to quickly trace IAP issues on device/Metro
  console.log("[IAP]", ...args);
};

type IapPurchase = {
  transactionId?: string;
  originalTransactionIdentifier?: string;
  productId?: string;
  // Allow additional fields returned by the native module without strict typing
  [key: string]: unknown;
};

let iapModule: any = null;
const getIap = () => {
  if (!iapModule) {
    // Using require to avoid ESM resolution-mode warnings in this CJS-compiled module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    iapModule = require("react-native-iap");
  }
  return iapModule;
};

export const initIapConnection = async () => {
  if (Platform.OS !== "ios") return;
  const RNIap = getIap();
  await RNIap.initConnection();
};

export const fetchProducts = async () => {
  if (Platform.OS !== "ios") return [];
  const RNIap = getIap();
  await initIapConnection();
  const products = await RNIap.fetchProducts({
    skus: Object.values(productIds),
    type: "subs",
  });
  log("fetchProducts ->", products?.length ?? 0, "items", products);
  return products;
};

export const purchaseSubscription = async (plan: PlanChoice) => {
  if (Platform.OS !== "ios") {
    throw new Error("Apple IAP is only available on iOS devices.");
  }

  const RNIap = getIap();
  await initIapConnection();
  const productId = productIds[plan];
  log("purchaseSubscription init", { plan, productId, bundleIdHint: "check Xcode target + EXPO_PUBLIC_IOS_BUNDLE_ID" });

  // Probe the store catalog before requesting purchase to catch SKU visibility issues
  try {
    const catalog = await RNIap.fetchProducts({ skus: Object.values(productIds), type: "subs" });
    log("purchaseSubscription fetchProducts", catalog);
  } catch (err) {
    log("purchaseSubscription fetchProducts error", err);
  }

  let purchase: IapPurchase;
  try {
    purchase = (await RNIap.requestPurchase({
      type: "subs",
      request: {
        ios: {
          sku: productId,
          andDangerouslyFinishTransactionAutomatically: false,
        },
      },
    })) as IapPurchase;
    log("purchase response", purchase);
  } catch (err) {
    log("requestPurchase error", err);
    throw err;
  }

  let transactionId =
    purchase.transactionId ??
    purchase.originalTransactionIdentifier ??
    (purchase as { originalTransactionId?: string }).originalTransactionId;

  // Fallback: ask iOS for the latest transaction on this SKU
  if (!transactionId) {
    const latest = await RNIap.latestTransactionIOS(productId);
    transactionId =
      latest?.transactionId ??
      latest?.originalTransactionIdentifier ??
      (latest as { originalTransactionId?: string })?.originalTransactionId;
    log("latestTransactionIOS", { productId, latest, resolvedTransactionId: transactionId });
  }

  if (!transactionId) {
    throw new Error("Missing transaction id from Apple receipt.");
  }

  const validation = await validateIosReceipt({ transactionId });

  try {
    await RNIap.finishTransaction({ purchase, isConsumable: false });
  } catch (err) {
    // If finishing fails, surface the validation response so the backend still captures entitlement.
    console.warn("Failed to finish Apple transaction", err);
  }

  return { ...validation, productId };
};

export const restorePurchases = async () => {
  if (Platform.OS !== "ios") {
    throw new Error("Restore purchases is only available on iOS.");
  }

  const RNIap = getIap();
  await initIapConnection();
  const purchases = (await RNIap.getAvailablePurchases()) as IapPurchase[];
  log("restore getAvailablePurchases", purchases);
  const active = purchases.find((purchase: IapPurchase) => {
    const id = purchase.productId ?? purchase.originalTransactionIdentifier;
    return id ? Object.values(productIds).includes(id) : false;
  });

  if (!active) {
    throw new Error("No App Store purchases to restore.");
  }

  const transactionId = active.transactionId ?? active.originalTransactionIdentifier;
  if (!transactionId) {
    throw new Error("Apple did not return a transaction id to restore.");
  }

  const validation = await validateIosReceipt({ transactionId });
  return { ...validation, productId: active.productId };
};

export const settlePendingPurchases = async () => {
  if (Platform.OS !== "ios") return;
  const RNIap = getIap();
  await initIapConnection();
  const purchases = (await RNIap.getAvailablePurchases()) as IapPurchase[];
  await Promise.all(
    purchases.map(async (purchase: IapPurchase) => {
      try {
        await RNIap.finishTransaction({ purchase, isConsumable: false });
      } catch (err) {
        console.warn("Failed to finish pending Apple transaction", err);
      }
    })
  );
};
