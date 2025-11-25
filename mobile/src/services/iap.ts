import { Platform } from "react-native";
import * as RNIap from "react-native-iap";
import { PlanChoice, validateIosReceipt } from "../api/subscriptions";

const productIds: Record<PlanChoice, string> = {
  monthly: "pro_monthly_subscription",
  annual: "pro_annual_subscription",
};

export const initIapConnection = async () => {
  if (Platform.OS !== "ios") return;
  await RNIap.initConnection();
};

export const fetchProducts = async () => {
  if (Platform.OS !== "ios") return [];
  await initIapConnection();
  return RNIap.getSubscriptions(Object.values(productIds));
};

export const purchaseSubscription = async (plan: PlanChoice) => {
  if (Platform.OS !== "ios") {
    throw new Error("Apple IAP is only available on iOS devices.");
  }

  await initIapConnection();
  const productId = productIds[plan];

  const purchase = await RNIap.requestSubscription({
    sku: productId,
    andDangerouslyFinishTransactionAutomaticallyIOS: false,
  });

  const transactionId = purchase.transactionId ?? purchase.originalTransactionIdentifier;
  if (!transactionId) {
    throw new Error("Missing transaction id from Apple receipt.");
  }

  const validation = await validateIosReceipt({ transactionId });

  try {
    await RNIap.finishTransaction(purchase, true);
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

  await initIapConnection();
  const purchases = await RNIap.getAvailablePurchases();
  const active = purchases.find((purchase) => {
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
  await initIapConnection();
  const purchases = await RNIap.getAvailablePurchases();
  await Promise.all(
    purchases.map(async (purchase) => {
      try {
        await RNIap.finishTransaction(purchase, true);
      } catch (err) {
        console.warn("Failed to finish pending Apple transaction", err);
      }
    })
  );
};
