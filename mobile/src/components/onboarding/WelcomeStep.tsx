import { useState } from "react";
import { Pressable, Text, TextInput, View, Image, Alert, Linking, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { processAvatarAsset } from "../../utils/avatarImage";

interface WelcomeStepProps {
  name: string;
  handle: string;
  avatarUri?: string;
  onNameChange: (name: string) => void;
  onHandleChange: (handle: string) => void;
  onAvatarChange: (uri: string | undefined) => void;
  isRetake?: boolean;
}

const WelcomeStep = ({
  name,
  handle,
  avatarUri,
  onNameChange,
  onHandleChange,
  onAvatarChange,
  isRetake = false,
}: WelcomeStepProps) => {
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

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
      setIsProcessingPhoto(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.75,
        base64: false,
        aspect: [1, 1],
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
      if (!result.canceled && result.assets?.length) {
        const processed = await processAvatarAsset(result.assets[0]);
        onAvatarChange(processed);
      }
    } catch (err) {
      console.warn("Image picker failed", err);
      Alert.alert("Could not open photos", "Please try again.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          Welcome to your fitness journey
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Let's start by setting up your profile. Choose a name and handle so friends can find you.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Profile photo (optional)
        </Text>
        <Pressable
          onPress={pickAvatar}
          disabled={isProcessingPhoto}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed || isProcessingPhoto ? 0.9 : 1,
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
            {isProcessingPhoto ? (
              <ActivityIndicator
                size='small'
                color={colors.primary}
                style={{ position: "absolute" }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              {isProcessingPhoto ? "Processing photo…" : avatarUri ? "Change photo" : "Add a photo"}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {isProcessingPhoto
                ? "Making sure your picture is shareable."
                : "A clear photo helps friends recognize you."}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <InputField label="Name" value={name} onChangeText={onNameChange} placeholder="Your name" />
        {!isRetake && (
          <View style={{ gap: 6 }}>
            <InputField
              label="Handle (required)"
              value={handle}
              onChangeText={onHandleChange}
              placeholder="@username"
            />
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Handles are required and can be updated every 30 days.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) => (
  <View style={{ gap: 6 }}>
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        fontFamily: fontFamilies.medium,
      }}
    />
  </View>
);

export default WelcomeStep;
