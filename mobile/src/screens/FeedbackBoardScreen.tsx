import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useFeedbackItems,
  useAdminStatus,
  useUpdateFeedbackStatus,
  FeedbackStatus,
  FeedbackItem,
} from "../api/feedback";
import { FeedbackCard } from "../components/feedback/FeedbackCard";
import { SubmitFeedbackModal } from "../components/feedback/SubmitFeedbackModal";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { colors } from "../theme/colors";

type SortOption = "trending" | "top" | "recent";

const SORT_OPTIONS: { value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "trending", label: "Trending", icon: "trending-up" },
  { value: "top", label: "Top", icon: "trophy" },
  { value: "recent", label: "Recent", icon: "time" },
];

const STATUS_FILTERS: { value: FeedbackStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "shipped", label: "Shipped" },
];

export const FeedbackBoardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

  const { user } = useCurrentUser();
  const { data: adminData } = useAdminStatus();
  const isAdmin = adminData?.isAdmin ?? false;

  const { data, isLoading, isError, refetch, isRefetching } = useFeedbackItems({
    sort: sortBy,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const updateStatus = useUpdateFeedbackStatus();

  const items = data?.items ?? [];

  const handleItemPress = (item: FeedbackItem) => {
    if (isAdmin) {
      setSelectedItem(item);
      showAdminOptions(item);
    } else {
      // For regular users, show a detail view
      Alert.alert(
        item.title,
        item.description,
        [
          {
            text: "Close",
            style: "cancel",
          },
        ]
      );
    }
  };

  const showAdminOptions = (item: FeedbackItem) => {
    const statusOptions: FeedbackStatus[] = [
      "submitted",
      "under_review",
      "planned",
      "in_progress",
      "shipped",
      "wont_fix",
      "duplicate",
    ];

    const buttons = statusOptions.map((status) => ({
      text: status.replace(/_/g, " ").toUpperCase(),
      onPress: () => handleStatusUpdate(item.id, status),
    }));

    buttons.push({
      text: "Cancel",
      onPress: () => {},
    });

    Alert.alert("Update Status", `Current: ${item.status}`, buttons);
  };

  const handleStatusUpdate = (id: string, status: FeedbackStatus) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => {
          Alert.alert("Success", "Status updated successfully");
          setSelectedItem(null);
        },
        onError: (error: any) => {
          Alert.alert("Error", error.message ?? "Failed to update status");
        },
      }
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading feedback...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.emptyStateTitle}>
            Failed to load feedback
          </Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyStateTitle}>No feedback yet</Text>
        <Text style={styles.emptyStateDescription}>
          Be the first to share your ideas and help shape the future of Push/Pull!
        </Text>
        <TouchableOpacity
          onPress={() => setShowSubmitModal(true)}
          style={styles.submitButton}
        >
          <Text style={styles.submitButtonText}>Submit Feedback</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback Board</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </View>

        <Text style={styles.headerSubtitle}>
          Share your ideas and vote on features you'd like to see
        </Text>
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.sortOptionsRow}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setSortBy(option.value)}
                activeOpacity={0.7}
                style={[
                  styles.sortOption,
                  sortBy === option.value ? styles.sortOptionActive : styles.sortOptionInactive
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={sortBy === option.value ? colors.background : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === option.value ? styles.sortOptionTextActive : styles.sortOptionTextInactive
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Status Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterOptionsRow}>
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                onPress={() => setStatusFilter(filter.value)}
                activeOpacity={0.7}
                style={[
                  styles.filterOption,
                  statusFilter === filter.value
                    ? styles.filterOptionActive
                    : styles.filterOptionInactive
                ]}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    statusFilter === filter.value ? styles.filterOptionTextActive : styles.filterOptionTextInactive
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Feedback List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <FeedbackCard
              item={item}
              onPress={() => handleItemPress(item)}
              isAdmin={isAdmin}
              currentUserId={user?.id}
            />
          </View>
        )}
        ListEmptyComponent={renderEmptyState()}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Floating Action Button */}
      <View style={styles.fab}>
        <TouchableOpacity
          onPress={() => setShowSubmitModal(true)}
          activeOpacity={0.8}
          style={styles.fabButton}
        >
          <Ionicons name="add" size={28} color={colors.background} />
        </TouchableOpacity>
      </View>

      {/* Submit Modal */}
      <SubmitFeedbackModal visible={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
  },
  adminBadge: {
    backgroundColor: `${colors.primary}33`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  sortContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: colors.primary,
  },
  sortOptionInactive: {
    backgroundColor: colors.surface,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  sortOptionTextActive: {
    color: colors.background,
  },
  sortOptionTextInactive: {
    color: colors.textSecondary,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterOptionActive: {
    backgroundColor: colors.secondary,
  },
  filterOptionInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  filterOptionTextActive: {
    color: colors.background,
  },
  filterOptionTextInactive: {
    color: colors.textSecondary,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  cardContainer: {
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
  },
  emptyStateDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  submitButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 20,
  },
  fabButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
