import { useState, useContext } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  ScrollView,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { NavigationContext } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCurrentUser } from "../hooks/useCurrentUser";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import {
  FitnessGoal,
  ExperienceLevel,
  EquipmentType,
  TrainingSplit,
  PartialOnboardingData,
  BodyGender,
} from "../types/onboarding";
import WelcomeStep from "../components/onboarding/WelcomeStep";
import GoalsStep from "../components/onboarding/GoalsStep";
import ExperienceLevelStep from "../components/onboarding/ExperienceLevelStep";
import EquipmentStep from "../components/onboarding/EquipmentStep";
import ScheduleStep from "../components/onboarding/ScheduleStep";
import LimitationsStep from "../components/onboarding/LimitationsStep";
import BodyProfileStep from "../components/onboarding/BodyProfileStep";
import TrainingStyleStep from "../components/onboarding/TrainingStyleStep";
import PlanSelectionStep from "../components/onboarding/PlanSelectionStep";

const TOTAL_STEPS = 9;

const OnboardingScreen = () => {
  const { completeOnboarding, updateProfile, user } = useCurrentUser();
  const insets = useSafeAreaInsets();
  // Get navigation - will be undefined if rendered outside NavigationContainer (OnboardingGate)
  const navigation = useContext(NavigationContext);
  // Determine if this is a retake by checking if user has existing onboarding data
  // This works for both navigation contexts (OnboardingGate and Onboarding screen in navigator)
  const isRetake = Boolean(user?.onboardingData);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Welcome
  const [name, setName] = useState(user?.name ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatarUrl ?? undefined);

  // Step 2: Goals
  const [selectedGoals, setSelectedGoals] = useState<FitnessGoal[]>(user?.onboardingData?.goals ?? []);

  // Step 3: Experience
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | undefined>(user?.onboardingData?.experienceLevel);

  // Step 4: Equipment
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType[]>(user?.onboardingData?.availableEquipment ?? []);
  const [customEquipment, setCustomEquipment] = useState<string[]>(user?.onboardingData?.customEquipment ?? []);

  // Step 5: Schedule
  const [weeklyFrequency, setWeeklyFrequency] = useState<number | undefined>(user?.onboardingData?.weeklyFrequency);
  const [sessionDuration, setSessionDuration] = useState<number | undefined>(user?.onboardingData?.sessionDuration);

  // Step 6: Limitations
  const [injuryNotes, setInjuryNotes] = useState(user?.onboardingData?.injuryNotes ?? "");
  const [movementsToAvoid, setMovementsToAvoid] = useState<string[]>(user?.onboardingData?.movementsToAvoid ?? []);

  // Step 7: Body profile (optional)
  const [bodyGender, setBodyGender] = useState<BodyGender | undefined>(user?.onboardingData?.bodyGender);
  const [heightCm, setHeightCm] = useState<number | undefined>(user?.onboardingData?.heightCm);
  const [weightKg, setWeightKg] = useState<number | undefined>(user?.onboardingData?.weightKg);

  // Step 8: Training Style
  const [preferredSplit, setPreferredSplit] = useState<TrainingSplit | undefined>(user?.onboardingData?.preferredSplit);

  // Step 9: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro">("free");

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return selectedGoals.length > 0;
      case 3:
        return experienceLevel !== undefined;
      case 4:
        return selectedEquipment.length > 0;
      case 5:
        return weeklyFrequency !== undefined && sessionDuration !== undefined;
      case 6:
        return true; // Optional step
      case 7:
        return true; // Optional body profile
      case 8:
        return preferredSplit !== undefined;
      case 9:
        return true; // Plan selection step - always can proceed
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      setError("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const onboardingData: PartialOnboardingData = {
      goals: selectedGoals,
      experienceLevel,
      availableEquipment: selectedEquipment,
      customEquipment: selectedEquipment.includes("custom") ? customEquipment : undefined,
      weeklyFrequency,
      sessionDuration,
      injuryNotes: injuryNotes.trim() || undefined,
      movementsToAvoid: movementsToAvoid.length > 0 ? movementsToAvoid : undefined,
      bodyGender,
      heightCm,
      weightKg,
      preferredSplit,
    };

    try {
      await completeOnboarding({
        name: name.trim(),
        handle: handle.trim() || undefined,
        avatarUrl: avatarUri,
        onboardingData: onboardingData as any,
      });

      // If editing preferences (isRetake) and inside a navigator, go back
      if (isRetake && navigation) {
        // @ts-ignore - navigation object from context
        navigation.goBack();
      }
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
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
      case 1:
        return (
          <WelcomeStep
            name={name}
            handle={handle}
            avatarUri={avatarUri}
            onNameChange={setName}
            onHandleChange={setHandle}
            onAvatarChange={setAvatarUri}
            isRetake={isRetake}
          />
        );
      case 2:
        return <GoalsStep selectedGoals={selectedGoals} onGoalsChange={setSelectedGoals} />;
      case 3:
        return (
          <ExperienceLevelStep
            selectedLevel={experienceLevel}
            onLevelChange={setExperienceLevel}
          />
        );
      case 4:
        return (
          <EquipmentStep
            selectedEquipment={selectedEquipment}
            customEquipment={customEquipment}
            onEquipmentChange={setSelectedEquipment}
            onCustomEquipmentChange={setCustomEquipment}
          />
        );
      case 5:
        return (
          <ScheduleStep
            weeklyFrequency={weeklyFrequency}
            sessionDuration={sessionDuration}
            onWeeklyFrequencyChange={setWeeklyFrequency}
            onSessionDurationChange={setSessionDuration}
          />
        );
      case 6:
        return (
          <LimitationsStep
            injuryNotes={injuryNotes}
            movementsToAvoid={movementsToAvoid}
            onInjuryNotesChange={setInjuryNotes}
            onMovementsToAvoidChange={setMovementsToAvoid}
          />
        );
      case 7:
        return (
          <BodyProfileStep
            gender={bodyGender}
            heightCm={heightCm}
            weightKg={weightKg}
            onGenderChange={setBodyGender}
            onHeightChange={setHeightCm}
            onWeightChange={setWeightKg}
          />
        );
      case 8:
        return (
          <TrainingStyleStep selectedSplit={preferredSplit} onSplitChange={setPreferredSplit} />
        );
      case 9:
        return (
          <PlanSelectionStep
            selectedPlan={selectedPlan}
            onPlanChange={setSelectedPlan}
            onContinueFree={handleSubmit}
            onStartTrial={handleSubmit}
          />
        );
      default:
        return null;
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel editing?",
      "Your current preferences will remain unchanged.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Cancel editing",
          style: "destructive",
          onPress: () => {
            // Navigate back if inside a navigator
            if (navigation) {
              // @ts-ignore - navigation object from context
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, gap: 16, marginTop: 16 }}>
          {/* Progress indicator */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Step {currentStep} of {TOTAL_STEPS}
              </Text>
              {isRetake && (
                <Pressable
                  onPress={handleCancel}
                  disabled={isSubmitting}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: pressed || isSubmitting ? 0.6 : 1,
                  })}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
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
                      backgroundColor:
                        isCompleted || isCurrent
                          ? colors.primary
                          : `${colors.textSecondary}30`,
                      opacity: isCompleted || isCurrent ? 1 : 0.5,
                    }}
                  />
                );
              })}
            </View>
          </View>

          {/* Step content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {renderStep()}
          </ScrollView>

          {/* Error message */}
          {error && (
            <Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text>
          )}

          {/* Navigation buttons */}
          <View style={{ gap: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
            <Pressable
              onPress={currentStep === TOTAL_STEPS ? handleSubmit : handleNext}
              disabled={!canProceed() || isSubmitting}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: canProceed() && !isSubmitting ? colors.primary : colors.border,
                alignItems: "center",
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
                {isSubmitting
                  ? "Saving..."
                  : currentStep === TOTAL_STEPS
                    ? "Complete Setup"
                    : "Continue"}
              </Text>
            </Pressable>

            {currentStep > 1 && (
              <Pressable
                onPress={handleBack}
                disabled={isSubmitting}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  opacity: pressed || isSubmitting ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.medium,
                    fontSize: 16,
                  }}
                >
                  Back
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default OnboardingScreen;
