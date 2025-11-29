import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Platform,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import {
  PlanChoice,
  createBillingPortalSession,
  getSubscriptionStatus,
  switchSubscriptionPlan,
} from "../api/subscriptions";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { startSubscription } from "../services/payments";

const plans: Record<
  PlanChoice,
  {
    title: string;
    price: string;
    blurb: string;
    badge?: string;
    savings?: string;
  }
> = {
  monthly: {
    title: "Monthly",
    price: "$4.99",
    blurb: "Billed monthly. Cancel anytime.",
    badge: "Most flexible",
  },
  annual: {
    title: "Annual",
    price: "$49.99",
    blurb: "Billed yearly. Save about $10 compared to monthly.",
    badge: "Best value",
    savings: "Save ~$10/yr",
  },
};

const formatDate = (timestamp?: number | null, fallback?: string | null) => {
  if (!timestamp && !fallback) return undefined;
  const date = timestamp
    ? new Date(timestamp * 1000)
    : fallback
    ? new Date(fallback)
    : null;
  return date ? date.toLocaleDateString() : undefined;
};

const UpgradeScreen = () => {
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>("monthly");
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const stripe = useStripe();
  const isIOS = Platform.OS === "ios";

  const statusQuery = useQuery({
    queryKey: ["subscription", "status"],
    queryFn: getSubscriptionStatus,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnMount: false, // Don't refetch on every mount, use cached data
  });

  const currentInterval = statusQuery.data?.currentInterval ?? null;
  const isPro = statusQuery.data?.plan === "pro" || statusQuery.data?.plan === "lifetime";
  const isAppleSubscription =
    statusQuery.data?.subscriptionPlatform === "apple";

  useEffect(() => {
    if (isPro && currentInterval) {
      setSelectedPlan(currentInterval === "annual" ? "monthly" : "annual");
    }
  }, [isPro, currentInterval]);

  const startCheckout = useMutation({
    mutationFn: (plan: PlanChoice) =>
      startSubscription({
        plan,
        stripe,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
      }),
    onError: (err: unknown) => {
      const error = err as { message?: string; code?: string };
      if (error.code === "USER_CANCELLED" || error.message === "USER_CANCELLED") {
        // Silent no-op for user-initiated cancellations
        return;
      }
      Alert.alert(
        isIOS ? "Purchase failed" : "Checkout failed",
        error.message || "Something went wrong. Please try again."
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["subscription", "status"],
      });
      Alert.alert(
        "Success",
        isIOS
          ? "Your Apple subscription is active."
          : "Your subscription is active."
      );
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

  const switchPlan = useMutation({
    mutationFn: (plan: PlanChoice) => switchSubscriptionPlan(plan),
    onError: (err: Error) => Alert.alert("Unable to switch", err.message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["subscription", "status"],
      });

      // Stripe applies prorations immediately for both upgrades and downgrades
      const isUpgrade =
        currentInterval === "monthly" && selectedPlan === "annual";
      const message = isUpgrade
        ? "Your plan has been upgraded to annual. You were charged the difference after applying a credit for your unused monthly time."
        : "Your plan has been switched to monthly. You received a prorated credit for your unused annual time.";

      Alert.alert("Plan Updated", message);
    },
  });

  const nextRenewal = useMemo(
    () =>
      formatDate(
        statusQuery.data?.currentPeriodEnd,
        statusQuery.data?.planExpiresAt ?? undefined
      ),
    [statusQuery.data?.currentPeriodEnd, statusQuery.data?.planExpiresAt]
  );

  const trialEnds = statusQuery.data?.trialEndsAt
    ? formatDate(statusQuery.data.trialEndsAt)
    : undefined;

  const screenTitle = isPro
    ? isAppleSubscription
      ? "Manage with Apple"
      : currentInterval
      ? "Switch Plans"
      : "Manage Subscription"
    : isIOS
    ? "Upgrade to Pro"
    : "Upgrade to Pro";

  const screenDescription = isPro
    ? currentInterval
      ? `You're currently on the ${
          currentInterval === "annual" ? "annual" : "monthly"
        } plan. Switch to save or get more flexibility.`
      : isAppleSubscription
      ? "Manage your Pro subscription from your Apple ID subscriptions."
      : "Manage your Pro subscription and billing details."
    : "Unlock AI workouts, analytics, and premium templates. First-time upgrades get a 7-day trial.";

  // Determine which plans to show
  const availablePlans: PlanChoice[] =
    isPro && isAppleSubscription
      ? currentInterval
        ? [currentInterval]
        : ["monthly"]
      : isPro && currentInterval
      ? [currentInterval === "annual" ? "monthly" : "annual"]
      : ["monthly", "annual"];

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
            fontSize: 28,
          }}
        >
          {screenTitle}
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.regular,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {screenDescription}
        </Text>
      </View>

      {/* Current Plan Badge (for Pro users) */}
      {isPro && currentInterval ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: "rgba(34,197,94,0.08)",
            padding: 14,
            gap: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Current Plan:{" "}
                {currentInterval === "annual" ? "Annual" : "Monthly"}
              </Text>
            </View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.bold,
                fontSize: 16,
              }}
            >
              {plans[currentInterval].price}
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.regular,
                  fontSize: 13,
                }}
              >
                {currentInterval === "annual" ? "/yr" : "/mo"}
              </Text>
            </Text>
          </View>
          {nextRenewal ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {statusQuery.data?.cancelAtPeriodEnd
                ? `Ends on ${nextRenewal}`
                : `Renews on ${nextRenewal}`}
            </Text>
          ) : null}
          {trialEnds ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Trial ends {trialEnds}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Plan Options */}
      <View style={{ gap: 12 }}>
        {availablePlans.map((plan) => {
          const details = plans[plan];
          const isSelected = plan === selectedPlan;
          const isCurrentPlan = isPro && currentInterval === plan;
          const isSelectionLocked = isAppleSubscription && isPro;

          return (
            <TouchableOpacity
              key={plan}
              onPress={() => setSelectedPlan(plan)}
              disabled={isCurrentPlan || isSelectionLocked}
              style={{
                borderRadius: 16,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isCurrentPlan
                  ? colors.surfaceMuted
                  : isSelected
                  ? "rgba(34,197,94,0.05)"
                  : colors.surface,
                padding: 18,
                gap: 10,
                opacity: isCurrentPlan || isSelectionLocked ? 0.6 : 1,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.bold,
                        fontSize: 18,
                      }}
                    >
                      {details.title}
                    </Text>
                    {details.savings ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: colors.primary,
                        }}
                      >
                        <Text
                          style={{
                            color: "#041108",
                            fontFamily: fontFamilies.bold,
                            fontSize: 11,
                          }}
                        >
                          {details.savings}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: 4,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.bold,
                        fontSize: 32,
                      }}
                    >
                      {details.price}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: fontFamilies.medium,
                        fontSize: 16,
                      }}
                    >
                      {plan === "annual" ? "/year" : "/month"}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamilies.regular,
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {details.blurb}
                  </Text>
                </View>
                {isSelected && !isCurrentPlan && !isSelectionLocked ? (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: "#041108",
                        fontFamily: fontFamilies.bold,
                        fontSize: 16,
                      }}
                    >
                      ✓
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Features section - only show for non-Pro users */}
      {!isPro ? (
        <View
          style={{
            gap: 12,
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 16,
              marginBottom: 4,
            }}
          >
            What's included
          </Text>
          <FeatureRow title='AI workout generator' />
          <FeatureRow title='Progression analytics' />
          <FeatureRow title='Premium templates & swaps' />
          <FeatureRow title='Priority support' />
        </View>
      ) : null}

      {/* Billing Change Notice for Pro users switching plans */}
      {isPro &&
      currentInterval &&
      currentInterval !== selectedPlan &&
      !isAppleSubscription ? (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: "rgba(34,197,94,0.08)",
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 14,
            }}
          >
            Switch applies immediately with prorated credit
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {selectedPlan === "annual"
              ? `You'll be charged $49.99 for annual billing, minus a prorated credit for the unused time on your current monthly plan. Your new billing cycle starts today.`
              : "You'll switch to monthly billing now and receive a prorated credit for any unused time on your annual plan. Your billing date will change."}
          </Text>
        </View>
      ) : null}

      {/* CTA Button */}
      <TouchableOpacity
        disabled={
          startCheckout.isPending ||
          statusQuery.isLoading ||
          portalMutation.isPending ||
          switchPlan.isPending
        }
        onPress={() => {
          if (isPro && isAppleSubscription) {
            void Linking.openURL(
              "https://apps.apple.com/account/subscriptions"
            );
            return;
          }
          if (isPro && currentInterval) {
            switchPlan.mutate(selectedPlan);
          } else if (isPro) {
            portalMutation.mutate();
          } else {
            startCheckout.mutate(selectedPlan);
          }
        }}
        style={{
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: "center",
          justifyContent: "center",
          opacity:
            startCheckout.isPending ||
            portalMutation.isPending ||
            switchPlan.isPending
              ? 0.7
              : 1,
        }}
      >
        {startCheckout.isPending ||
        portalMutation.isPending ||
        switchPlan.isPending ? (
          <ActivityIndicator color='#041108' />
        ) : (
          <Text
            style={{
              color: "#041108",
              fontFamily: fontFamilies.bold,
              fontSize: 17,
            }}
          >
            {isPro
              ? isAppleSubscription
                ? "Manage in App Store"
                : currentInterval
                ? `Switch to ${
                    selectedPlan === "annual" ? "Annual" : "Monthly"
                  } Plan`
                : "Manage Subscription"
              : isIOS
              ? "Subscribe with Apple"
              : "Start 7-Day Trial"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Trial disclaimer for new users */}
      {!isPro ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            textAlign: "center",
            lineHeight: 18,
            marginTop: -8,
          }}
        >
          Your trial starts today. Cancel anytime during the trial period and
          you won't be charged.
        </Text>
      ) : null}

      {/* Billing Portal Access for Pro users */}
      {isPro ? (
        <View style={{ gap: 12 }}>
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: 8,
            }}
          />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {isAppleSubscription
              ? "Manage your subscription from your Apple ID."
              : "Need to update payment methods or cancel?"}
          </Text>
          {isAppleSubscription ? (
            <TouchableOpacity
              onPress={() =>
                Linking.openURL("https://apps.apple.com/account/subscriptions")
              }
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: colors.surface,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Open Apple Subscriptions
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: colors.surface,
              }}
            >
              {portalMutation.isPending ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 15,
                  }}
                >
                  Manage Billing & Payment
                </Text>
              )}
            </TouchableOpacity>
          )}
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
