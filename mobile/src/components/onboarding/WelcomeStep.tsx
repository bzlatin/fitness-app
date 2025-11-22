import { useState } from "react";
import { Pressable, Text, TextInput, View, Image, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

interface WelcomeStepProps {
  name: string;
  handle: string;
  avatarUri?: string;
  onNameChange: (name: string) => void;
  onHandleChange: (handle: string) => void;
  onAvatarChange: (uri: string | undefined) => void;
}

const WelcomeStep = ({
  name,
  handle,
  avatarUri,
  onNameChange,
  onHandleChange,
  onAvatarChange,
}: WelcomeStepProps) => {
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
        onAvatarChange(result.assets[0]?.uri);
      }
    } catch (err) {
      console.warn("Image picker failed", err);
      Alert.alert("Could not open photos", "Please try again.");
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
        <InputField label="Name" value={name} onChangeText={onNameChange} placeholder="Your name" />
        <InputField
          label="Handle (optional)"
          value={handle}
          onChangeText={onHandleChange}
          placeholder="@username"
        />
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
