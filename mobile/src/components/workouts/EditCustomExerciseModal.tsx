import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import {
  updateCustomExercise,
  uploadCustomExerciseImage,
  deleteCustomExercise,
} from "../../api/exercises";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { CustomExercise } from "../../types/workouts";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  exercise: CustomExercise;
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

const EditCustomExerciseModal = ({
  visible,
  onClose,
  onUpdated,
  onDeleted,
  exercise,
}: Props) => {
  const [name, setName] = useState(exercise.name);
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState(exercise.primaryMuscleGroup);
  const [equipment, setEquipment] = useState(exercise.equipment || "bodyweight");
  const [notes, setNotes] = useState(exercise.notes || "");
  const [imageUri, setImageUri] = useState<string | null>(exercise.imageUrl || null);
  const [hasImageChanged, setHasImageChanged] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const queryClient = useQueryClient();

  // Update state when exercise changes
  useEffect(() => {
    setName(exercise.name);
    setPrimaryMuscleGroup(exercise.primaryMuscleGroup);
    setEquipment(exercise.equipment || "bodyweight");
    setNotes(exercise.notes || "");
    setImageUri(exercise.imageUrl || null);
    setHasImageChanged(false);
  }, [exercise]);

  const updateMutation = useMutation({
    mutationFn: updateCustomExercise,
    onSuccess: async () => {
      // If image changed, upload it
      if (hasImageChanged && imageUri && !imageUri.startsWith("http")) {
        try {
          setIsUploadingImage(true);
          await uploadCustomExerciseImage(exercise.id, imageUri);
        } catch (error) {
          console.error("Failed to upload image:", error);
          Alert.alert("Warning", "Exercise updated but image upload failed.");
        } finally {
          setIsUploadingImage(false);
        }
      }

      // Invalidate exercises cache
      queryClient.invalidateQueries({ queryKey: ["exercises-all"] });
      queryClient.invalidateQueries({ queryKey: ["custom-exercises"] });

      onUpdated();
      onClose();

      Alert.alert("Success", "Custom exercise updated successfully!");
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to update custom exercise. Please try again."
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomExercise,
    onSuccess: () => {
      // Invalidate exercises cache
      queryClient.invalidateQueries({ queryKey: ["exercises-all"] });
      queryClient.invalidateQueries({ queryKey: ["custom-exercises"] });

      onDeleted();
      onClose();

      Alert.alert("Success", "Custom exercise deleted successfully!");
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to delete custom exercise. Please try again."
      );
    },
  });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add an exercise image."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setHasImageChanged(true);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    setHasImageChanged(true);
  };

  const handleUpdate = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter an exercise name");
      return;
    }

    if (!primaryMuscleGroup) {
      Alert.alert("Error", "Please select a primary muscle group");
      return;
    }

    updateMutation.mutate([exercise.id, {
      name: name.trim(),
      primaryMuscleGroup,
      equipment: equipment || undefined,
      notes: notes.trim() || undefined,
      // If image was removed, send empty string to clear it
      imageUrl: !imageUri && hasImageChanged ? "" : undefined,
    }]);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate(exercise.id);
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                  Edit Exercise
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: "rgba(34,197,94,0.12)",
                    borderRadius: 4,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.primary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    CUSTOM
                  </Text>
                </View>
              </View>
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
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
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
              />
            </View>

            {/* Exercise Image (Optional) */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
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
                  <Text
                    style={{ ...typography.caption, color: colors.textSecondary, opacity: 0.7 }}
                  >
                    Optional - helps identify the exercise
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Primary Muscle Group */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
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
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
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
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
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

            {/* Delete Button */}
            <Pressable
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: "rgba(239,68,68,0.1)",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text
                style={{
                  fontFamily: fontFamilies.semibold,
                  color: colors.error,
                  fontSize: 16,
                }}
              >
                Delete Exercise
              </Text>
            </Pressable>
          </ScrollView>

          {/* Update Button */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Pressable
              onPress={handleUpdate}
              disabled={
                updateMutation.isPending || isUploadingImage || !name.trim() || !primaryMuscleGroup
              }
              style={({ pressed }) => ({
                backgroundColor:
                  !name.trim() || !primaryMuscleGroup ? colors.surfaceMuted : colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              {updateMutation.isPending || isUploadingImage ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color={colors.surface} />
                  <Text style={{ fontFamily: fontFamilies.medium, color: colors.surface, fontSize: 16 }}>
                    {isUploadingImage ? "Uploading image..." : "Updating..."}
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontFamily: fontFamilies.semibold,
                    color:
                      !name.trim() || !primaryMuscleGroup ? colors.textSecondary : colors.surface,
                    fontSize: 16,
                  }}
                >
                  Save Changes
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              gap: 16,
            }}
          >
            <View style={{ alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(239,68,68,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={28} color={colors.error} />
              </View>
              <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                Delete Exercise?
              </Text>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                Are you sure you want to delete "{exercise.name}"? This action cannot be undone.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Pressable
                onPress={confirmDelete}
                disabled={deleteMutation.isPending}
                style={({ pressed }) => ({
                  backgroundColor: colors.error,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text
                    style={{
                      fontFamily: fontFamilies.semibold,
                      color: colors.surface,
                      fontSize: 16,
                    }}
                  >
                    Delete
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
                style={({ pressed }) => ({
                  backgroundColor: colors.surfaceMuted,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.semibold,
                    color: colors.textPrimary,
                    fontSize: 16,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default EditCustomExerciseModal;
