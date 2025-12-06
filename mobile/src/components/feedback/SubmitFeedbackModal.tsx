import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  FeedbackCategory,
  FeedbackImpact,
  useCreateFeedback,
  getCategoryDisplayName,
  getImpactDisplayName,
} from "../../api/feedback";
import { colors } from "../../theme/colors";

type SubmitFeedbackModalProps = {
  visible: boolean;
  onClose: () => void;
};

const CATEGORIES: FeedbackCategory[] = [
  "feature_request",
  "bug_report",
  "ui_ux_improvement",
  "performance",
  "social_features",
];

const IMPACTS: FeedbackImpact[] = [
  "must_have",
  "nice_to_have",
  "critical",
  "high",
  "medium",
  "low",
];

export const SubmitFeedbackModal: React.FC<SubmitFeedbackModalProps> = ({
  visible,
  onClose,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("feature_request");
  const [impact, setImpact] = useState<FeedbackImpact>("medium");

  const createFeedback = useCreateFeedback();

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title for your feedback");
      return;
    }

    if (title.length > 200) {
      Alert.alert("Error", "Title must be 200 characters or less");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }

    if (description.length > 2000) {
      Alert.alert("Error", "Description must be 2000 characters or less");
      return;
    }

    createFeedback.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        category,
        impact,
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Thank you for your feedback! We'll review it soon.");
          resetForm();
          onClose();
        },
        onError: (error: any) => {
          Alert.alert("Error", error.message ?? "Failed to submit feedback");
        },
      }
    );
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("feature_request");
    setImpact("medium");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Submit Feedback</Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createFeedback.isPending}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.submitText,
                createFeedback.isPending && styles.submitTextDisabled
              ]}
            >
              {createFeedback.isPending ? "Sending..." : "Submit"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Brief summary of your feedback"
              placeholderTextColor={colors.textSecondary}
              maxLength={200}
              style={styles.textInput}
            />
            <Text style={styles.charCount}>
              {title.length}/200 characters
            </Text>
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide more details about your feedback..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={6}
              maxLength={2000}
              textAlignVertical="top"
              style={[styles.textInput, styles.textInputMultiline]}
            />
            <Text style={styles.charCount}>
              {description.length}/2000 characters
            </Text>
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.optionsContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                  style={[
                    styles.optionButton,
                    category === cat ? styles.optionButtonActive : styles.optionButtonInactive
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      category === cat ? styles.optionTextActive : styles.optionTextInactive
                    ]}
                  >
                    {getCategoryDisplayName(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Impact Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Impact <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.optionsContainer}>
              {IMPACTS.map((imp) => (
                <TouchableOpacity
                  key={imp}
                  onPress={() => setImpact(imp)}
                  activeOpacity={0.7}
                  style={[
                    styles.optionButton,
                    impact === imp ? styles.impactButtonActive : styles.optionButtonInactive
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      impact === imp ? styles.optionTextActive : styles.optionTextInactive
                    ]}
                  >
                    {getImpactDisplayName(imp)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Helper Text */}
          <View style={styles.helperBox}>
            <View style={styles.helperContent}>
              <Ionicons name="information-circle" size={20} color={colors.secondary} />
              <View style={styles.helperTextContainer}>
                <Text style={styles.helperText}>
                  Your feedback helps us prioritize what to build next. We review all
                  submissions and update their status as we make progress.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  submitTextDisabled: {
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  required: {
    color: colors.error,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 16,
  },
  textInputMultiline: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCount: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
  },
  impactButtonActive: {
    backgroundColor: colors.secondary,
  },
  optionButtonInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  optionTextActive: {
    color: colors.background,
  },
  optionTextInactive: {
    color: colors.textSecondary,
  },
  helperBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 16,
    marginVertical: 32,
  },
  helperContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  helperTextContainer: {
    flex: 1,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
