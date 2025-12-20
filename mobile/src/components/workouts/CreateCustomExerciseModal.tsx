import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { createCustomExercise, uploadCustomExerciseImage } from "../../api/exercises";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { Exercise } from "../../types/workouts";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
  initialName?: string;
  squadId?: string;
  enableSquadSharing?: boolean;
};

const MUSCLE_GROUPS = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "legs", label: "Legs" },
  { value: "glutes", label: "Glutes" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "other", label: "Other" },
];

const EQUIPMENT_OPTIONS = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "bands", label: "Bands" },
  { value: "other", label: "Other" },
];

const CreateCustomExerciseModal = ({
  visible,
  onClose,
  onCreated,
  initialName,
  squadId,
  enableSquadSharing = false,
}: Props) => {
  const [name, setName] = useState(initialName || "");
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("bodyweight");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [scope, setScope] = useState<"personal" | "squad">("personal");

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createCustomExercise,
    onSuccess: async (data) => {
      let uploadedImageUrl: string | undefined;
      // If there's an image, upload it
      if (imageUri) {
        try {
          setIsUploadingImage(true);
          const upload = await uploadCustomExerciseImage(data.id, imageUri);
          uploadedImageUrl = upload.imageUrl;
        } catch (error) {
          console.error("Failed to upload image:", error);
          Alert.alert("Warning", "Exercise created but image upload failed. You can add an image later.");
        } finally {
          setIsUploadingImage(false);
        }
      }

      // Invalidate exercises cache to refetch with new custom exercise
      queryClient.invalidateQueries({ queryKey: ["exercises-all"] });
      queryClient.invalidateQueries({ queryKey: ["custom-exercises"] });

      // Convert CustomExercise to Exercise format
      const exercise: Exercise = {
        id: data.id,
        name: data.name,
        primaryMuscleGroup: data.primaryMuscleGroup,
        equipment: data.equipment || "bodyweight",
        gifUrl: uploadedImageUrl,
        isCustom: true,
        createdBy: data.userId,
      };

      onCreated(exercise);

      // Reset form
      setName("");
      setPrimaryMuscleGroup("");
      setEquipment("bodyweight");
      setNotes("");
      setImageUri(null);
      setScope("personal");

      onClose();

      // Show success message
      Alert.alert("Success", "Custom exercise created successfully!");
    },
    onError: (error: any) => {
      if (error.response?.status === 403 && error.response?.data?.requiresUpgrade) {
        // User hit free tier limit
        Alert.alert(
          "Upgrade to Pro",
          error.response.data.message || "You've reached the free tier limit. Upgrade to Pro for unlimited custom exercises.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Upgrade",
              onPress: () => {
                onClose();
                // TODO: Navigate to upgrade screen
              }
            },
          ]
        );
      } else {
        Alert.alert(
          "Error",
          error.response?.data?.error || "Failed to create custom exercise. Please try again."
        );
      }
    },
  });

  const handlePickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add an exercise image."
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter an exercise name");
      return;
    }

    if (!primaryMuscleGroup) {
      Alert.alert("Error", "Please select a primary muscle group");
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      primaryMuscleGroup,
      equipment: equipment || undefined,
      notes: notes.trim() || undefined,
      scope: enableSquadSharing && scope === "squad" ? "squad" : "personal",
      squadId: enableSquadSharing && scope === "squad" ? squadId : undefined,
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                Create Custom Exercise
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Exercise Name */}
            <View style={{ gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Exercise Name <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <TextInput
                placeholder="e.g. Cable Hip Abduction"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.regular,
                  fontSize: 16,
                }}
                autoFocus
              />
            </View>

            {/* Exercise Image (Optional) */}
            <View style={{ gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Exercise Image (Optional)
              </Text>
              {imageUri ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={{
                      width: "100%",
                      height: 200,
                      resizeMode: "cover",
                    }}
                  />
                  <Pressable
                    onPress={handleRemoveImage}
                    style={({ pressed }) => ({
                      position: "absolute",
                      top: 8,
                      right: 8,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      borderRadius: 20,
                      padding: 8,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Ionicons name="close" size={20} color={colors.surface} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickImage}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderStyle: "dashed",
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    paddingVertical: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                  <Text style={{ ...typography.body, color: colors.textSecondary }}>
                    Tap to add photo
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary, opacity: 0.7 }}>
                    Optional - helps identify the exercise
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Primary Muscle Group */}
            <View style={{ gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Primary Muscle Group <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {MUSCLE_GROUPS.map((group) => (
                  <Pressable
                    key={group.value}
                    onPress={() => setPrimaryMuscleGroup(group.value)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor:
                        primaryMuscleGroup === group.value ? colors.primary : colors.border,
                      backgroundColor:
                        primaryMuscleGroup === group.value
                          ? "rgba(34,197,94,0.12)"
                          : colors.surface,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamilies.medium,
                        color:
                          primaryMuscleGroup === group.value
                            ? colors.primary
                            : colors.textPrimary,
                      }}
                    >
                      {group.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Equipment (Optional) */}
            <View style={{ gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Equipment (Optional)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <Pressable
                    key={eq.value}
                    onPress={() => setEquipment(eq.value)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: equipment === eq.value ? colors.primary : colors.border,
                      backgroundColor:
                        equipment === eq.value ? "rgba(34,197,94,0.12)" : colors.surface,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamilies.medium,
                        color: equipment === eq.value ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {eq.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes (Optional) */}
            <View style={{ gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Notes (Optional)
              </Text>
              <TextInput
                placeholder="e.g. Focus on gluteus medius for hip stability"
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.regular,
                  fontSize: 16,
                  minHeight: 100,
                }}
              />
            </View>

            {/* Squad Sharing (Optional - only shown if squad context) */}
            {enableSquadSharing && squadId && (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Share with Squad
                </Text>
                <View style={{ gap: 12 }}>
                  <Pressable
                    onPress={() => setScope("personal")}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: scope === "personal" ? colors.primary : colors.border,
                      backgroundColor:
                        scope === "personal" ? "rgba(34,197,94,0.08)" : colors.surface,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: scope === "personal" ? colors.primary : colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {scope === "personal" && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.primary,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: fontFamilies.semibold,
                          color: colors.textPrimary,
                          fontSize: 15,
                        }}
                      >
                        Personal
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                        Only visible to you
                      </Text>
                    </View>
                    <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable
                    onPress={() => setScope("squad")}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: scope === "squad" ? colors.primary : colors.border,
                      backgroundColor:
                        scope === "squad" ? "rgba(34,197,94,0.08)" : colors.surface,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: scope === "squad" ? colors.primary : colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {scope === "squad" && (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.primary,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: fontFamilies.semibold,
                          color: colors.textPrimary,
                          fontSize: 15,
                        }}
                      >
                        Share with Squad
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                        All squad members can use this exercise
                      </Text>
                    </View>
                    <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Info Box */}
            <View
              style={{
                backgroundColor: "rgba(56,189,248,0.1)",
                borderWidth: 1,
                borderColor: "rgba(56,189,248,0.3)",
                borderRadius: 12,
                padding: 12,
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Ionicons name="information-circle" size={20} color={colors.secondary} />
              <Text
                style={{
                  flex: 1,
                  ...typography.caption,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
              >
                {enableSquadSharing && scope === "squad"
                  ? "This exercise will be visible to all squad members and can be used in their workout templates."
                  : "Custom exercises are only visible to you and can be used in your workout templates just like library exercises."}
              </Text>
            </View>
          </ScrollView>

          {/* Create Button */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Pressable
              onPress={handleCreate}
              disabled={createMutation.isPending || isUploadingImage || !name.trim() || !primaryMuscleGroup}
              style={({ pressed }) => ({
                backgroundColor:
                  !name.trim() || !primaryMuscleGroup
                    ? colors.surfaceMuted
                    : colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              {createMutation.isPending || isUploadingImage ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color={colors.surface} />
                  <Text style={{ fontFamily: fontFamilies.medium, color: colors.surface, fontSize: 16 }}>
                    {isUploadingImage ? "Uploading image..." : "Creating..."}
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontFamily: fontFamilies.semibold,
                    color:
                      !name.trim() || !primaryMuscleGroup
                        ? colors.textSecondary
                        : colors.surface,
                    fontSize: 16,
                  }}
                >
                  Create Exercise
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* TODO: Add PaywallComparisonModal here when showPaywall is true */}
      {/* You can import and use your existing paywall modal */}
    </>
  );
};

export default CreateCustomExerciseModal;
