import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ScreenContainer from '../components/layout/ScreenContainer';
import WelcomeStep from '../components/onboarding/WelcomeStep';
import PlanSelectionStep from '../components/onboarding/PlanSelectionStep';
import NotificationsStep from '../components/onboarding/NotificationsStep';
import { useAuth } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { colors } from '../theme/colors';
import { fontFamilies, typography } from '../theme/typography';
import { normalizeHandle } from '../utils/formatHandle';
import { isRemoteAvatarUrl } from '../utils/avatarImage';
import { uploadCurrentUserAvatar } from '../api/social';
import type { PlanChoice } from '../api/subscriptions';
import type { OnboardingData } from '../types/onboarding';
import { startSubscription } from '../services/payments';
import { loadPreAuthOnboarding, markPreAuthOnboardingLinked } from '../services/preAuthOnboarding';
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess';
import { registerForPushNotificationsAsync } from '../services/notifications';

type Props = {
  onFinished: () => void;
};

const TOTAL_STEPS = 3;

const AccountSetupScreen = ({ onFinished }: Props) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const subscriptionAccess = useSubscriptionAccess();
  const { logout, isAuthorizing } = useAuth();
  const { user, updateProfile, completeOnboarding } = useCurrentUser();

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [name, setName] = useState(user?.name ?? 'Athlete');
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatarUrl ?? undefined);

  const [pendingOnboardingData, setPendingOnboardingData] = useState<OnboardingData | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro'>('pro');
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const handlePlanChange = (plan: 'free' | 'pro') => {
    if (plan === 'pro' && Platform.OS !== 'ios') {
      Alert.alert(
        'Not available',
        'Pro subscriptions are currently available on iOS only. Android billing is coming soon.'
      );
      setSelectedPlan('free');
      return;
    }
    setSelectedPlan(plan);
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        if (!mounted) return;
        if (user?.handle) return;
        if (handle.trim()) return;
        const base = (user?.name ?? user?.email ?? 'athlete').split('@')[0];
        const cleaned = base.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 10) || 'athlete';
        const suffix = String(Math.floor(100 + Math.random() * 900));
        setHandle(`@${cleaned}${suffix}`);
      } catch {
        // ignore
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPending = async () => {
      try {
        const stored = await loadPreAuthOnboarding();
        if (!mounted) return;
        if (user?.onboardingData) return;
        if (stored?.status !== 'completed') return;
        const data = stored.data as OnboardingData | undefined;
        if (!data) return;
        if (
          !data.goals?.length ||
          !data.experienceLevel ||
          !data.availableEquipment?.length ||
          !data.weeklyFrequency ||
          !data.sessionDuration ||
          !data.preferredSplit
        ) {
          return;
        }
        setPendingOnboardingData(data);
      } catch (err) {
        console.warn('[AccountSetup] Failed to load pre-auth onboarding', err);
      }
    };
    void loadPending();
    return () => {
      mounted = false;
    };
  }, [user?.onboardingData]);

  const canProceedProfile = useMemo(() => {
    const normalized = normalizeHandle(handle);
    return name.trim().length > 0 && normalized.trim().length > 0;
  }, [name, handle]);

  const saveProfileDetails = async () => {
    if (!canProceedProfile) {
      setError('Add a name and handle to continue.');
      return false;
    }

    const normalized = normalizeHandle(handle);
    if (!normalized) {
      setError('Pick a handle so friends can find you.');
      return false;
    }

    setIsSavingProfile(true);
    setError(null);
    try {
      let uploadReadyAvatar = isRemoteAvatarUrl(avatarUri) ? avatarUri : undefined;
      if (avatarUri && !uploadReadyAvatar) {
        try {
          uploadReadyAvatar = await uploadCurrentUserAvatar(avatarUri);
          setAvatarUri(uploadReadyAvatar);
        } catch (err) {
          console.error('[AccountSetup] Avatar upload failed', err);
          uploadReadyAvatar = undefined;
        }
      }
      await updateProfile({
        name: name.trim(),
        handle: normalized,
        avatarUrl: uploadReadyAvatar,
        ...(pendingOnboardingData && !user?.onboardingData
          ? { onboardingData: pendingOnboardingData as any }
          : {}),
      });

      if (pendingOnboardingData && user?.id) {
        await markPreAuthOnboardingLinked(user.id);
      }

      return true;
    } catch (err) {
      console.error('[AccountSetup] Failed to save profile', err);
      const message =
        err instanceof Error && err.message.includes('Handle already taken')
          ? 'That handle is taken. Try another.'
          : (err as Error)?.message ?? 'Could not save. Please try again.';
      setError(message);
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const finishSetup = async () => {
    try {
      if (notificationsEnabled) {
        await registerForPushNotificationsAsync();
      }
    } catch (err) {
      console.error('[AccountSetup] Failed to register notifications', err);
    }

    await completeOnboarding({});
    onFinished();
  };

  const handleContinueFromProfile = async () => {
    const ok = await saveProfileDetails();
    if (!ok) return;
    setCurrentStep(2);
  };

  const startCheckout = useMutation({
    mutationFn: (plan: PlanChoice) =>
      startSubscription({
        plan,
      }),
    onError: (err: unknown) => {
      const error = err as { message?: string; code?: string };
      if (error.code === 'USER_CANCELLED' || error.message === 'USER_CANCELLED') {
        return;
      }
      Alert.alert(
        Platform.OS === 'ios' ? 'Purchase failed' : 'Not available',
        error.message || 'Something went wrong. Please try again.'
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscription', 'status'] });
      await finishSetup();
    },
  });

  const handleContinueFree = async () => {
    setError(null);
    try {
      await finishSetup();
    } catch (err) {
      console.error('[AccountSetup] Failed to complete onboarding', err);
      setError('Could not finish setup. Please try again.');
    }
  };

  const handleStartTrial = async (planType: 'monthly' | 'yearly') => {
    if (subscriptionAccess.hasProAccess) {
      await finishSetup();
      return;
    }
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Not available',
        'Pro subscriptions are currently available on iOS only. Android billing is coming soon.'
      );
      return;
    }
    const planChoice: PlanChoice = planType === 'yearly' ? 'annual' : 'monthly';
    startCheckout.mutate(planChoice);
  };

  const isBusy = isAuthorizing || isSavingProfile || startCheckout.isPending;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, gap: 16, marginTop: 16 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Step {currentStep} of {TOTAL_STEPS}
              </Text>
              <Pressable
                onPress={logout}
                disabled={isBusy}
                style={({ pressed }) => ({
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  opacity: pressed || isBusy ? 0.6 : 1,
                })}
              >
                <Text style={{ color: colors.primary, fontFamily: fontFamilies.semibold, fontSize: 13 }}>
                  Switch account
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
                const stepNumber = index + 1;
                const isCompleted = stepNumber < currentStep;
                const isCurrent = stepNumber === currentStep;
                return (
                  <View
                    key={stepNumber}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: isCompleted || isCurrent ? colors.primary : `${colors.textSecondary}30`,
                      opacity: isCompleted || isCurrent ? 1 : 0.5,
                    }}
                  />
                );
              })}
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 1 ? (
              <View style={{ gap: 14 }}>
                {pendingOnboardingData ? (
                  <View
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: `${colors.secondary}12`,
                      borderWidth: 1,
                      borderColor: `${colors.secondary}24`,
                      flexDirection: 'row',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Ionicons name='checkmark-circle' size={18} color={colors.secondary} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 13 }}>
                        Preferences saved
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
                        We’ll apply your goals and schedule once you finish setup.
                      </Text>
                    </View>
                  </View>
                ) : null}
                <WelcomeStep
                  name={name}
                  handle={handle}
                  avatarUri={avatarUri}
                  onNameChange={setName}
                  onHandleChange={setHandle}
                  onAvatarChange={setAvatarUri}
                  isRetake={false}
                />
              </View>
            ) : currentStep === 2 ? (
              <PlanSelectionStep
                selectedPlan={selectedPlan}
                onPlanChange={handlePlanChange}
                onContinueFree={handleContinueFree}
                onStartTrial={handleStartTrial}
                isProcessingPurchase={startCheckout.isPending}
                selectedBilling={selectedBilling}
                onBillingChange={setSelectedBilling}
                hideCta
              />
            ) : (
              <NotificationsStep
                notificationsEnabled={notificationsEnabled}
                onNotificationsEnabledChange={setNotificationsEnabled}
              />
            )}
          </ScrollView>

          {error ? <Text style={{ color: colors.error, textAlign: 'center' }}>{error}</Text> : null}

          {currentStep === 1 ? (
            <View style={{ gap: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
              <Pressable
                onPress={() => void handleContinueFromProfile()}
                disabled={!canProceedProfile || isBusy}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: canProceedProfile && !isBusy ? colors.primary : colors.border,
                  alignItems: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                {isSavingProfile ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
                    Continue
                  </Text>
                )}
              </Pressable>
            </View>
          ) : currentStep === 2 ? (
            <View style={{ gap: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
              <Pressable
                onPress={() => setCurrentStep(3)}
                disabled={isBusy}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: isBusy ? colors.border : colors.primary,
                  alignItems: 'center',
                  opacity: pressed || isBusy ? 0.85 : 1,
                })}
              >
                <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
                  Continue
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCurrentStep(1)}
                disabled={isBusy}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: pressed || isBusy ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 15 }}>
                  Back
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
              <Pressable
                onPress={() =>
                  selectedPlan === 'pro'
                    ? void handleStartTrial(selectedBilling)
                    : void handleContinueFree()
                }
                disabled={isBusy}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: isBusy ? colors.border : colors.primary,
                  alignItems: 'center',
                  opacity: pressed || isBusy ? 0.85 : 1,
                })}
              >
                {startCheckout.isPending ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
                    {selectedPlan === 'pro' && Platform.OS === 'ios'
                      ? 'Start 7-Day Trial'
                      : 'Finish'}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setCurrentStep(2)}
                disabled={isBusy}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: pressed || isBusy ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 15 }}>
                  Back
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default AccountSetupScreen;
