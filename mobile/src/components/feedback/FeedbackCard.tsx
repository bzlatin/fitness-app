import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  FeedbackItem,
  getCategoryDisplayName,
  getStatusInfo,
  useToggleVote,
  useReportFeedback,
  useDeleteFeedback,
} from "../../api/feedback";
import { colors } from "../../theme/colors";

type FeedbackCardProps = {
  item: FeedbackItem;
  onPress?: () => void;
  isAdmin?: boolean;
  currentUserId?: string;
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ item, onPress, isAdmin, currentUserId }) => {
  const toggleVote = useToggleVote();
  const reportFeedback = useReportFeedback();
  const deleteFeedback = useDeleteFeedback();

  const statusInfo = getStatusInfo(item.status);

  const handleVote = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    toggleVote.mutate(item.id);
  };

  const handleReport = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();

    Alert.alert("Report Feedback", "Why are you reporting this feedback?", [
      {
        text: "Spam",
        onPress: () => submitReport("This is spam"),
      },
      {
        text: "Inappropriate",
        onPress: () => submitReport("Inappropriate content"),
      },
      {
        text: "Duplicate",
        onPress: () => submitReport("This is a duplicate"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const submitReport = (reason: string) => {
    reportFeedback.mutate(
      { id: item.id, reason },
      {
        onSuccess: (data) => {
          Alert.alert("Success", data.message);
        },
        onError: (error: any) => {
          Alert.alert("Error", error.message ?? "Failed to submit report");
        },
      }
    );
  };

  const handleDelete = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();

    Alert.alert(
      "Delete Feedback",
      "Are you sure you want to delete this feedback? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteFeedback.mutate(item.id, {
              onSuccess: (data) => {
                Alert.alert("Success", data.message);
              },
              onError: (error: any) => {
                Alert.alert("Error", error.message ?? "Failed to delete feedback");
              },
            });
          },
        },
      ]
    );
  };

  // Check if current user can delete (owner or admin)
  const canDelete = isAdmin || (currentUserId && item.userId === currentUserId);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.card}
    >
      {/* Header with status badge */}
      <View style={styles.header}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusInfo.bgColor }
          ]}
        >
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>

        <View style={styles.rightHeader}>
          {/* Category badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {getCategoryDisplayName(item.category)}
            </Text>
          </View>

          {/* Delete button (for owner or admin) */}
          {canDelete && (
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          )}

          {/* Report button (for non-admins who don't own it) */}
          {!isAdmin && !canDelete && (
            <TouchableOpacity onPress={handleReport} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{item.title}</Text>

      {/* Description preview */}
      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>

      {/* Footer with vote button and metadata */}
      <View style={styles.footer}>
        {/* Vote button */}
        <TouchableOpacity
          onPress={handleVote}
          activeOpacity={0.7}
          style={[
            styles.voteButton,
            item.userHasVoted ? styles.voteButtonActive : styles.voteButtonInactive
          ]}
          disabled={toggleVote.isPending}
        >
          <Ionicons
            name={item.userHasVoted ? "chevron-up" : "chevron-up-outline"}
            size={20}
            color={item.userHasVoted ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.voteCount,
              item.userHasVoted ? styles.voteCountActive : styles.voteCountInactive
            ]}
          >
            {item.voteCount}
          </Text>
        </TouchableOpacity>

        {/* User info */}
        <View style={styles.userInfo}>
          <Text style={styles.metaText}>
            by {item.user.handle ?? item.user.name}
          </Text>
          <Text style={styles.metaText}> • </Text>
          <Text style={styles.metaText}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
      </View>

      {/* Admin info */}
      {isAdmin && item.reportCount > 0 && (
        <View style={styles.adminInfo}>
          <Text style={styles.reportText}>
            ⚠️ {item.reportCount} report{item.reportCount > 1 ? "s" : ""}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateString).toLocaleDateString();
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  rightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voteButtonActive: {
    backgroundColor: `${colors.primary}33`,
  },
  voteButtonInactive: {
    backgroundColor: colors.surfaceMuted,
  },
  voteCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  voteCountActive: {
    color: colors.primary,
  },
  voteCountInactive: {
    color: colors.textSecondary,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  adminInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reportText: {
    fontSize: 12,
    color: colors.error,
  },
});
