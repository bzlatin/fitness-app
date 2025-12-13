import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../components/layout/ScreenContainer';
import GoalsStep from '../components/onboarding/GoalsStep';
import ExperienceLevelStep from '../components/onboarding/ExperienceLevelStep';
import EquipmentStep from '../components/onboarding/EquipmentStep';
import ScheduleStep from '../components/onboarding/ScheduleStep';
import TrainingStyleStep from '../components/onboarding/TrainingStyleStep';
import { ProgressIndicator } from '../components/onboarding/ProgressIndicator';
import { colors } from '../theme/colors';
import { fontFamilies, typography } from '../theme/typography';
import type {
  EquipmentType,
  ExperienceLevel,
  FitnessGoal,
  OnboardingData,
  TrainingSplit,
} from '../types/onboarding';
import {
  completePreAuthOnboarding,
  loadPreAuthOnboarding,
  savePreAuthOnboardingDraft,
  skipPreAuthOnboarding,
} from '../services/preAuthOnboarding';

type Props = {
  onFinished: () => void;
};

const PreAuthOnboardingScreen = ({ onFinished }: Props) => {
  const insets = useSafeAreaInsets();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const transition = useRef(new Animated.Value(0)).current;

  const [selectedGoals, setSelectedGoals] = useState<FitnessGoal[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | undefined>();
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType[]>([]);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [weeklyFrequency, setWeeklyFrequency] = useState<number | undefined>();
  const [sessionDuration, setSessionDuration] = useState<number | undefined>();
  const [preferredSplit, setPreferredSplit] = useState<TrainingSplit | undefined>();

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const existing = await loadPreAuthOnboarding();
        const draft = existing?.status === 'in_progress' ? existing.data : undefined;
        if (!mounted || !draft) return;
        setSelectedGoals((draft.goals as FitnessGoal[]) ?? []);
        setExperienceLevel(draft.experienceLevel as ExperienceLevel | undefined);
        setSelectedEquipment((draft.availableEquipment as EquipmentType[]) ?? []);
        setCustomEquipment((draft.customEquipment as string[]) ?? []);
        setWeeklyFrequency(draft.weeklyFrequency as number | undefined);
        setSessionDuration(draft.sessionDuration as number | undefined);
        setPreferredSplit(draft.preferredSplit as TrainingSplit | undefined);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setReduceMotion(enabled);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const draftPayload = useMemo(
    () => ({
      goals: selectedGoals,
      experienceLevel,
      availableEquipment: selectedEquipment,
      customEquipment: selectedEquipment.includes('custom') ? customEquipment : undefined,
      weeklyFrequency,
      sessionDuration,
      preferredSplit,
    }),
    [
      selectedGoals,
      experienceLevel,
      selectedEquipment,
      customEquipment,
      weeklyFrequency,
      sessionDuration,
      preferredSplit,
    ]
  );

  const canProceed = () => {
    switch (currentStepIndex) {
      case 0:
        return true;
      case 1:
        return selectedGoals.length > 0;
      case 2:
        return experienceLevel !== undefined;
      case 3:
        return selectedEquipment.length > 0;
      case 4:
        return weeklyFrequency !== undefined && sessionDuration !== undefined;
      case 5:
        return preferredSplit !== undefined;
      default:
        return false;
    }
  };

  const persistDraft = async () => {
    try {
      await savePreAuthOnboardingDraft(draftPayload);
    } catch (err) {
      console.warn('[PreAuthOnboarding] Failed to save draft', err);
    }
  };

  const handleSkip = async () => {
    try {
      await skipPreAuthOnboarding();
    } finally {
      onFinished();
    }
  };

  const handleNext = async () => {
    setError(null);
    if (!canProceed()) {
      setError('Please complete the step to continue.');
      return;
    }

    await persistDraft();

    if (currentStepIndex < STEP_ORDER.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      return;
    }

    const onboardingData: OnboardingData = {
      goals: selectedGoals,
      experienceLevel: experienceLevel!,
      availableEquipment: selectedEquipment,
      customEquipment: selectedEquipment.includes('custom') ? customEquipment : undefined,
      weeklyFrequency: weeklyFrequency!,
      sessionDuration: sessionDuration!,
      preferredSplit: preferredSplit!,
    };

    try {
      await completePreAuthOnboarding(onboardingData);
      setIsTransitioning(true);
      if (reduceMotion) {
        onFinished();
        return;
      }
      transition.setValue(0);
      Animated.timing(transition, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
      setTimeout(() => onFinished(), 520);
    } catch (err) {
      console.warn('[PreAuthOnboarding] Failed to complete onboarding', err);
      setError('Could not save your preferences. Please try again.');
    }
  };

  const handleBack = async () => {
    setError(null);
    await persistDraft();
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const renderStep = () => {
    switch (currentStepIndex) {
      case 0:
        return <IntroStep />;
      case 1:
        return <GoalsStep selectedGoals={selectedGoals} onGoalsChange={setSelectedGoals} />;
      case 2:
        return (
          <ExperienceLevelStep selectedLevel={experienceLevel} onLevelChange={setExperienceLevel} />
        );
      case 3:
        return (
          <EquipmentStep
            selectedEquipment={selectedEquipment}
            customEquipment={customEquipment}
            onEquipmentChange={setSelectedEquipment}
            onCustomEquipmentChange={setCustomEquipment}
          />
        );
      case 4:
        return (
          <ScheduleStep
            weeklyFrequency={weeklyFrequency}
            sessionDuration={sessionDuration}
            onWeeklyFrequencyChange={setWeeklyFrequency}
            onSessionDurationChange={setSessionDuration}
          />
        );
      case 5:
        return (
          <TrainingStyleStep selectedSplit={preferredSplit} onSplitChange={setPreferredSplit} />
        );
      default:
        return null;
    }
  };

  if (isBootstrapping) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium }}>
            Loading…
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isTransitioning) {
    const translateY = transition.interpolate({
      inputRange: [0, 1],
      outputRange: [10, 0],
    });
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <Animated.View style={{ opacity: transition, transform: [{ translateY }] }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: `${colors.primary}18`,
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name='checkmark' size={34} color={colors.primary} />
            </View>
            <Text style={{ ...typography.heading2, color: colors.textPrimary, textAlign: 'center' }}>
              Locked in.
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 6,
                maxWidth: 300,
              }}
            >
              Next up: sign in to save everything across devices.
            </Text>
            <View style={{ marginTop: 14, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          </Animated.View>
        </View>
      </ScreenContainer>
    );
  }

  const showProgress = currentStepIndex > 0;
  const progressCurrent = Math.max(currentStepIndex - 1, 0);
  const progressTotal = STEP_ORDER.length - 1;

  return (
    <ScreenContainer>
      <View style={{ flex: 1, gap: 12, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={handleBack}
            disabled={currentStepIndex === 0}
            hitSlop={12}
            style={({ pressed }) => ({
              opacity: currentStepIndex === 0 ? 0 : pressed ? 0.6 : 1,
              paddingVertical: 6,
              paddingHorizontal: 6,
            })}
          >
            <Ionicons name='chevron-back' size={22} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={handleSkip}
            hitSlop={12}
            style={({ pressed }) => ({
              paddingVertical: 6,
              paddingHorizontal: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold, fontSize: 13 }}>
              Skip
            </Text>
          </Pressable>
        </View>

        {showProgress ? (
          <ProgressIndicator currentStep={progressCurrent} totalSteps={progressTotal} />
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        {error ? (
          <Text style={{ color: colors.error, textAlign: 'center', marginTop: 6 }}>{error}</Text>
        ) : null}

        <View style={{ paddingBottom: Math.max(insets.bottom, 16), gap: 10 }}>
          <Pressable
            onPress={handleNext}
            disabled={!canProceed()}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: canProceed() ? colors.primary : colors.border,
              alignItems: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              {currentStepIndex === STEP_ORDER.length - 1 ? 'Continue' : 'Next'}
            </Text>
          </Pressable>

          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              textAlign: 'center',
            }}
          >
            You can change this later in settings.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
};

const IntroStep = () => (
  <View style={{ gap: 18, paddingTop: 8 }}>
    <View style={{ gap: 10 }}>
      <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
        Build your plan in under a minute
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary }}>
        Answer a few quick questions and we’ll tailor Push / Pull to your goals, schedule, and equipment.
      </Text>
    </View>

    <View style={{ gap: 12 }}>
      <ValueRow icon='sparkles' title='Smarter sessions' subtitle='Better exercise selection and progression.' />
      <ValueRow icon='calendar' title='Fits your week' subtitle='Pick days/week and session length.' />
      <ValueRow icon='barbell' title='Matches your gear' subtitle='Gym, home, or bodyweight—no guesswork.' />
    </View>

    <View
      style={{
        marginTop: 6,
        padding: 14,
        borderRadius: 14,
        backgroundColor: `${colors.primary}10`,
        borderWidth: 1,
        borderColor: `${colors.primary}25`,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 14 }}>
        Pro tip
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 6, lineHeight: 18, fontSize: 13 }}>
        Skip anytime—your setup isn’t permanent.
      </Text>
    </View>
  </View>
);

const ValueRow = ({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) => (
  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 15 }}>
        {title}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
        {subtitle}
      </Text>
    </View>
  </View>
);

const STEP_ORDER = ['intro', 'goals', 'experience', 'equipment', 'schedule', 'split'] as const;

export default PreAuthOnboardingScreen;
