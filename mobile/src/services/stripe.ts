import { Stripe } from "@stripe/stripe-react-native";
import { CheckoutSessionPayload, PlanChoice, createCheckoutSession } from "../api/subscriptions";

type StripeCheckoutParams = CheckoutSessionPayload & {
  stripe: Stripe | null;
  userEmail?: string | null;
  userName?: string | null;
};

export const startCheckout = async ({
  plan,
  stripe,
  userEmail,
  userName,
}: StripeCheckoutParams) => {
  if (!stripe) {
    throw new Error("Stripe is not ready yet.");
  }
  const session = await createCheckoutSession({ plan });
  const initResult = await stripe.initPaymentSheet({
    merchantDisplayName: "Push / Pull",
    customerId: session.customerId,
    customerEphemeralKeySecret: session.customerEphemeralKeySecret,
    paymentIntentClientSecret: session.paymentIntentClientSecret,
    setupIntentClientSecret: session.setupIntentClientSecret,
    allowsDelayedPaymentMethods: false,
    defaultBillingDetails: {
      email: userEmail ?? undefined,
      name: userName ?? undefined,
    },
  });

  if (initResult.error) {
    throw new Error(initResult.error.message);
  }

  const presentResult = await stripe.presentPaymentSheet();
  if (presentResult.error) {
    throw new Error(presentResult.error.message);
  }

  return { status: "completed" as const, subscriptionId: session.subscriptionId };
};
