import { Platform } from "react-native";
import { Stripe } from "@stripe/stripe-react-native";
import { PlanChoice } from "../api/subscriptions";
import * as Iap from "./iap";
import * as StripePayments from "./stripe";

type StartParams = {
  plan: PlanChoice;
  stripe?: Stripe;
  userEmail?: string | null;
  userName?: string | null;
};

export const startSubscription = async ({ plan, stripe, userEmail, userName }: StartParams) => {
  if (Platform.OS === "ios") {
    return Iap.purchaseSubscription(plan);
  }

  if (!stripe) {
    throw new Error("Stripe not ready yet.");
  }

  return StripePayments.startCheckout({ plan, stripe, userEmail, userName });
};

export const restorePurchases = async () => {
  if (Platform.OS !== "ios") {
    throw new Error("Restore purchases is only required on iOS.");
  }
  return Iap.restorePurchases();
};

export const bootstrapPayments = async () => {
  if (Platform.OS !== "ios") return;
  try {
    await Iap.initIapConnection();
    await Iap.settlePendingPurchases();
  } catch (err) {
    console.warn(
      "[Payments] Skipping IAP bootstrap (likely Expo Go or missing native module):",
      err
    );
  }
};

export const fetchProductMetadata = async () => {
  if (Platform.OS !== "ios") return [];
  return Iap.fetchProducts();
};
