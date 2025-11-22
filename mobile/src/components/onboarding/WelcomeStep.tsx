import { View, Text, TextInput, Pressable, Image, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type WelcomeStepProps = {
  name: string;
  handle: string;
  avatarUri?: string;
  onNameChange: (name: string) => void;
  onHandleChange: (handle: string) => void;
  onAvatarChange: (uri: string | undefined) => void;
  isRetake?: boolean;
  isHandleLocked?: boolean;
};

export const WelcomeStep = ({
  name,
  handle,
  avatarUri,
  onNameChange,
  onHandleChange,
  onAvatarChange,
  isRetake = false,
  isHandleLocked = false,
}: WelcomeStepProps) => {
  const ensurePhotoPermission = async () => {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted || current.accessPrivileges === "limited") return true;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted || permission.accessPrivileges === "limited")
      return true;
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
        presentationStyle:
          ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
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
        <Text
          style={{
            ...typography.heading1,
            color: colors.textPrimary,
            fontSize: 28,
          }}
        >
          {isRetake ? "👋 Welcome back!" : "👋 Welcome!"}
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          {isRetake
            ? "Let's update your profile and training preferences."
            : "Let's get you set up! This'll only take a minute."}
        </Text>
      </View>

      <View style={{ gap: 12, alignItems: "center", marginVertical: 8 }}>
        <Pressable
          onPress={pickAvatar}
          style={({ pressed }) => ({
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 999,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: colors.primary,
            }}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: 100, height: 100, borderRadius: 999 }}
              />
            ) : (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 36,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                +
              </Text>
            )}
          </View>
        </Pressable>
        <Pressable onPress={pickAvatar}>
          <Text
            style={{
              color: colors.primary,
              fontFamily: fontFamilies.semibold,
              fontSize: 14,
            }}
          >
            {avatarUri ? "Change photo" : "Add photo"}
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
            }}
          >
            Your name *
          </Text>
          <TextInput
            value={name}
            onChangeText={onNameChange}
            placeholder="John Doe"
            placeholderTextColor={colors.textSecondary}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: fontFamilies.medium,
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
            }}
          >
            Handle {!isRetake && "(optional)"}
          </Text>
          <TextInput
            value={handle}
            onChangeText={onHandleChange}
            placeholder="@yourhandle"
            placeholderTextColor={colors.textSecondary}
            editable={!isHandleLocked}
            style={{
              backgroundColor: isHandleLocked
                ? colors.surface
                : colors.surfaceMuted,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              color: isHandleLocked ? colors.textSecondary : colors.textPrimary,
              fontFamily: fontFamilies.medium,
              fontSize: 16,
              opacity: isHandleLocked ? 0.6 : 1,
            }}
          />
          {isHandleLocked ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Handles are locked once set
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Your unique handle helps friends find you
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};
