import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import {
  CheckoutSessionPayload,
  PlanChoice,
  createBillingPortalSession,
  createCheckoutSession,
  getSubscriptionStatus,
} from "../api/subscriptions";
import { useCurrentUser } from "../hooks/useCurrentUser";

const plans: Record<
  PlanChoice,
  { title: string; price: string; blurb: string; badge?: string }
> = {
  monthly: {
    title: "Pro Monthly",
    price: "$4.99 / mo",
    blurb: "Flex month-to-month with a 7-day trial for first-time upgrades.",
    badge: "Most flexible",
  },
  annual: {
    title: "Pro Annual",
    price: "$47.99 / yr",
    blurb: "Commit and save vs monthly. Includes a 7-day first-time trial.",
    badge: "Best value",
  },
};

const formatDate = (timestamp?: number | null, fallback?: string | null) => {
  if (!timestamp && !fallback) return undefined;
  const date = timestamp ? new Date(timestamp * 1000) : fallback ? new Date(fallback) : null;
  return date ? date.toLocaleDateString() : undefined;
};

const UpgradeScreen = () => {
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>("monthly");
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const stripe = useStripe();

  const statusQuery = useQuery({
    queryKey: ["subscription", "status"],
    queryFn: getSubscriptionStatus,
  });

  const isPro = statusQuery.data?.plan === "pro";

  const startCheckout = useMutation({
    mutationFn: (payload: CheckoutSessionPayload) => createCheckoutSession(payload),
    onError: (err: Error) => {
      Alert.alert("Checkout failed", err.message);
    },
    onSuccess: async (session) => {
      const initResult = await stripe.initPaymentSheet({
        merchantDisplayName: "Push / Pull",
        customerId: session.customerId,
        customerEphemeralKeySecret: session.customerEphemeralKeySecret,
        paymentIntentClientSecret: session.paymentIntentClientSecret,
        setupIntentClientSecret: session.setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: user?.email,
          name: user?.name,
        },
      });

      if (initResult.error) {
        Alert.alert("Payment sheet error", initResult.error.message);
        return;
      }

      const presentResult = await stripe.presentPaymentSheet();
      if (presentResult.error) {
        if (presentResult.error.code !== "Canceled") {
          Alert.alert("Payment failed", presentResult.error.message);
        }
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["subscription", "status"] });
      Alert.alert("Success", "Your subscription is active.");
    },
  });

  const portalMutation = useMutation({
  mutationFn: () => createBillingPortalSession(),
  onError: (err: Error) => Alert.alert("Unable to open portal", err.message),
  onSuccess: (data) => {
      // Opening inside the device browser to keep return_url simple.
      void Linking.openURL(data.url);
  },
});

  const nextRenewal = useMemo(
    () =>
      formatDate(statusQuery.data?.currentPeriodEnd, statusQuery.data?.planExpiresAt ?? undefined),
    [statusQuery.data?.currentPeriodEnd, statusQuery.data?.planExpiresAt]
  );

  const trialEnds = statusQuery.data?.trialEndsAt
    ? formatDate(statusQuery.data.trialEndsAt)
    : undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
    >
      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamilies.bold,
            fontSize: 24,
          }}
        >
          Upgrade to Pro
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.regular,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Unlock AI workouts, analytics, and premium templates. First-time upgrades get a 7-day trial.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {(["monthly", "annual"] as PlanChoice[]).map((plan) => {
          const details = plans[plan];
          const isSelected = plan === selectedPlan;
          return (
            <TouchableOpacity
              key={plan}
              onPress={() => setSelectedPlan(plan)}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                padding: 16,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  {details.title}
                </Text>
                {details.badge ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: "rgba(34,197,94,0.12)",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 12,
                      }}
                    >
                      {details.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.bold,
                  fontSize: 20,
                }}
              >
                {details.price}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.regular,
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                {details.blurb}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ gap: 12 }}>
        <FeatureRow title='AI workout generator' />
        <FeatureRow title='Progression analytics' />
        <FeatureRow title='Premium templates & swaps' />
        <FeatureRow title='Priority support' />
      </View>

      <TouchableOpacity
        disabled={startCheckout.isPending || statusQuery.isLoading || portalMutation.isPending}
        onPress={() =>
          isPro ? portalMutation.mutate() : startCheckout.mutate({ plan: selectedPlan })
        }
        style={{
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
          opacity: startCheckout.isPending || portalMutation.isPending ? 0.8 : 1,
        }}
      >
        {startCheckout.isPending || portalMutation.isPending ? (
          <ActivityIndicator color="#041108" />
        ) : (
          <Text
            style={{
              color: "#041108",
            fontFamily: fontFamilies.bold,
            fontSize: 16,
          }}
        >
            {isPro ? "Manage subscription" : "Start trial & subscribe"}
        </Text>
        )}
      </TouchableOpacity>

      {isPro ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 14,
            gap: 6,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
            }}
          >
            Your plan
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {statusQuery.data?.status} · {selectedPlan === "annual" ? "Annual" : "Monthly"}
          </Text>
          {nextRenewal ? (
            <Text style={{ color: colors.textSecondary }}>
              Renews on {nextRenewal}
            </Text>
          ) : null}
          {trialEnds ? (
            <Text style={{ color: colors.textSecondary }}>
              Trial ends {trialEnds}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={() => portalMutation.mutate()}
            style={{
              marginTop: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            {portalMutation.isPending ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.medium,
                }}
              >
                Open billing portal
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
};

const FeatureRow = ({ title }: { title: string }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    }}
  >
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(34, 197, 94, 0.14)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.primary,
          fontFamily: fontFamilies.bold,
        }}
      >
        ✓
      </Text>
    </View>
    <Text
      style={{
        color: colors.textPrimary,
        fontFamily: fontFamilies.medium,
        fontSize: 14,
      }}
    >
      {title}
    </Text>
  </View>
);

export default UpgradeScreen;
