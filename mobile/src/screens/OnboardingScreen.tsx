import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useCurrentUser } from "../hooks/useCurrentUser";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";

const OnboardingScreen = () => {
  const { completeOnboarding } = useCurrentUser();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [trainingStyle, setTrainingStyle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("Add your name to personalize your profile.");
      return;
    }
    await completeOnboarding({
      name: name.trim(),
      handle: handle.trim() || undefined,
      bio: trainingStyle.trim() || undefined,
      trainingStyle: trainingStyle.trim() || undefined,
    });
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ gap: 16, marginTop: 16 }}>
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
            Set up your profile
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Choose a name and handle so friends can find you. You can change this later in
            Settings.
          </Text>

          <View style={{ gap: 10 }}>
            <InputField label="Name" value={name} onChangeText={setName} />
            <InputField
              label="Handle"
              value={handle}
              onChangeText={setHandle}
              placeholder="@pushpull"
            />
            <InputField
              label="Training focus / bio"
              value={trainingStyle}
              onChangeText={setTrainingStyle}
              placeholder="Push/pull, hybrid, running"
              multiline
            />
          </View>

          {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
              Continue
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) => (
  <View style={{ gap: 6 }}>
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      multiline={multiline}
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        minHeight: multiline ? 72 : undefined,
        fontFamily: fontFamilies.medium,
      }}
    />
  </View>
);

export default OnboardingScreen;
