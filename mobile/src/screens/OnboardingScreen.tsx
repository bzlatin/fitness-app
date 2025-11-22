import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  Image,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useCurrentUser } from "../hooks/useCurrentUser";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";

const OnboardingScreen = () => {
  const { completeOnboarding } = useCurrentUser();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [trainingStyle, setTrainingStyle] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | undefined>();

  const ensurePhotoPermission = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted || current.accessPrivileges === "limited") return true;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted || permission.accessPrivileges === "limited") return true;
    Alert.alert(
      "Permission needed",
      "Enable photo access to add a profile picture.",
      [
        {
          text: "Open settings",
          onPress: () => Linking.openSettings(),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
    return false;
  };

  const pickAvatar = async () => {
    const allowed = await ensurePhotoPermission();
    if (!allowed) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.85,
        aspect: [1, 1],
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
      if (!result.canceled && result.assets?.length) {
        setAvatarUri(result.assets[0]?.uri);
      }
    } catch (err) {
      console.warn("Image picker failed", err);
      Alert.alert("Could not open photos", "Please try again.");
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Add your name to personalize your profile.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await completeOnboarding({
        name: name.trim(),
        handle: handle.trim() || undefined,
        bio: trainingStyle.trim() || undefined,
        trainingStyle: trainingStyle.trim() || undefined,
        avatarUrl: avatarUri,
        weeklyGoal: Number(weeklyGoal) || 4,
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
            Choose a name and handle so friends can find you. Handles are unique, so pick
            one you want to keep.
          </Text>

          <View style={{ gap: 10 }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Profile photo (optional)
            </Text>
            <Pressable
              onPress={pickAvatar}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: 52, height: 52, borderRadius: 999 }}
                  />
                ) : (
                  <Text
                    style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}
                  >
                    +
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                  {avatarUri ? "Change photo" : "Add a photo"}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  A clear photo helps friends recognize you.
                </Text>
              </View>
            </Pressable>
          </View>

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
            <InputField
              label="Weekly workout goal"
              value={weeklyGoal}
              onChangeText={setWeeklyGoal}
              placeholder="4"
              keyboardType="numeric"
            />
          </View>

          {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={isSubmitting}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: "center",
              opacity: pressed || isSubmitting ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
              {isSubmitting ? "Saving..." : "Continue"}
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
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) => (
  <View style={{ gap: 6 }}>
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      multiline={multiline}
      keyboardType={keyboardType}
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
