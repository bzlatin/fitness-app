import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  Alert,
} from "react-native";
import { useCurrentUser } from "../hooks/useCurrentUser";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import { ProgressIndicator } from "../components/onboarding/ProgressIndicator";
import { WelcomeStep } from "../components/onboarding/WelcomeStep";
import { GoalsStep } from "../components/onboarding/GoalsStep";
import { ExperienceStep } from "../components/onboarding/ExperienceStep";
import { EquipmentStep } from "../components/onboarding/EquipmentStep";
import { ScheduleStep } from "../components/onboarding/ScheduleStep";
import { LimitationsStep } from "../components/onboarding/LimitationsStep";
import { TrainingSplitStep } from "../components/onboarding/TrainingSplitStep";
import { OnboardingData } from "../types/user";

type OnboardingScreenProps = {
  route?: {
    params?: {
      isRetake?: boolean;
    };
  };
};

const TOTAL_STEPS = 7;

const OnboardingScreen = ({ route }: OnboardingScreenProps) => {
  const { completeOnboarding, user } = useCurrentUser();
  const isRetake = route?.params?.isRetake ?? false;
  const isHandleLocked = Boolean(user?.handle);

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Welcome
  const [name, setName] = useState(user?.name ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(
    user?.avatarUrl
  );

  // Step 2: Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>(
    user?.onboardingData?.goals ?? []
  );

  // Step 3: Experience
  const [experienceLevel, setExperienceLevel] = useState<string>(
    user?.onboardingData?.experienceLevel ?? ""
  );

  // Step 4: Equipment
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(
    user?.onboardingData?.availableEquipment ?? []
  );

  // Step 5: Schedule
  const [weeklyFrequency, setWeeklyFrequency] = useState<number>(
    user?.onboardingData?.weeklyFrequency ?? user?.weeklyGoal ?? 4
  );
  const [sessionDuration, setSessionDuration] = useState<number>(
    user?.onboardingData?.sessionDuration ?? 45
  );

  // Step 6: Limitations
  const [injuryNotes, setInjuryNotes] = useState<string>(
    user?.onboardingData?.injuryNotes ?? ""
  );
  const [movementsToAvoid, setMovementsToAvoid] = useState<string>(
    user?.onboardingData?.movementsToAvoid ?? ""
  );

  // Step 7: Training Split
  const [preferredSplit, setPreferredSplit] = useState<string>(
    user?.onboardingData?.preferredSplit ?? ""
  );

  const canGoNext = () => {
    switch (currentStep) {
      case 0:
        return name.trim().length > 0;
      case 1:
        return selectedGoals.length > 0;
      case 2:
        return experienceLevel.length > 0;
      case 3:
        return selectedEquipment.length > 0;
      case 4:
        return true; // Schedule has defaults
      case 5:
        return true; // Limitations are optional
      case 6:
        return preferredSplit.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canGoNext()) {
      setError("Please complete this step before continuing");
      return;
    }
    setError(null);
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!canGoNext()) {
      setError("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const onboardingData: OnboardingData = {
        goals: selectedGoals,
        experienceLevel,
        availableEquipment: selectedEquipment,
        weeklyFrequency,
        sessionDuration,
        injuryNotes: injuryNotes.trim() || undefined,
        movementsToAvoid: movementsToAvoid.trim() || undefined,
        preferredSplit,
      };

      await completeOnboarding({
        name: name.trim(),
        handle: isHandleLocked ? undefined : handle.trim() || undefined,
        avatarUrl: avatarUri,
        weeklyGoal: weeklyFrequency,
        onboardingData,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("Handle already taken")
          ? "That handle is taken. Try another."
          : (err as Error)?.message ?? "Couldn't finish setup. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <WelcomeStep
            name={name}
            handle={handle}
            avatarUri={avatarUri}
            onNameChange={setName}
            onHandleChange={setHandle}
            onAvatarChange={setAvatarUri}
            isRetake={isRetake}
            isHandleLocked={isHandleLocked}
          />
        );
      case 1:
        return (
          <GoalsStep
            selectedGoals={selectedGoals}
            onGoalsChange={setSelectedGoals}
          />
        );
      case 2:
        return (
          <ExperienceStep
            experienceLevel={experienceLevel}
            onExperienceChange={setExperienceLevel}
          />
        );
      case 3:
        return (
          <EquipmentStep
            selectedEquipment={selectedEquipment}
            onEquipmentChange={setSelectedEquipment}
          />
        );
      case 4:
        return (
          <ScheduleStep
            weeklyFrequency={weeklyFrequency}
            sessionDuration={sessionDuration}
            onFrequencyChange={setWeeklyFrequency}
            onDurationChange={setSessionDuration}
          />
        );
      case 5:
        return (
          <LimitationsStep
            injuryNotes={injuryNotes}
            movementsToAvoid={movementsToAvoid}
            onInjuryNotesChange={setInjuryNotes}
            onMovementsToAvoidChange={setMovementsToAvoid}
          />
        );
      case 6:
        return (
          <TrainingSplitStep
            preferredSplit={preferredSplit}
            onSplitChange={setPreferredSplit}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ gap: 20, marginTop: 16, flex: 1 }}>
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
          />

          <View style={{ flex: 1 }}>{renderStep()}</View>

          {error ? (
            <View
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: `${colors.error}15`,
                borderWidth: 1,
                borderColor: colors.error,
              }}
            >
              <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 12 }}>
            {currentStep > 0 && (
              <Pressable
                onPress={handleBack}
                disabled={isSubmitting}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  opacity: pressed || isSubmitting ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  ← Back
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={isLastStep ? handleSubmit : handleNext}
              disabled={isSubmitting || !canGoNext()}
              style={({ pressed }) => ({
                flex: 2,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: canGoNext() ? colors.primary : colors.border,
                alignItems: "center",
                opacity: pressed || isSubmitting ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  color: canGoNext() ? colors.surface : colors.textSecondary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 16,
                }}
              >
                {isSubmitting
                  ? "Saving..."
                  : isLastStep
                  ? "🎉 Complete"
                  : "Continue →"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default OnboardingScreen;
