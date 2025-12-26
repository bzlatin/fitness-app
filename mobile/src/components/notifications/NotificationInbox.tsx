import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";
import {
  getNotificationInbox,
  markNotificationAsRead,
  markNotificationAsClicked,
  markAllNotificationsAsRead,
  deleteNotification,
  NotificationEvent,
} from "../../services/notifications";

interface NotificationCardProps {
  notification: NotificationEvent;
  onPress: (notification: NotificationEvent) => void;
  onDelete: (id: string) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onPress,
  onDelete,
}) => {
  const isUnread = !notification.read_at;

  const getIcon = () => {
    switch (notification.notification_type) {
      case "goal_risk":
        return "🎯";
      case "streak_risk":
        return "🔥";
      case "goal_missed":
        return "💫";
      case "inactivity":
        return "💪";
      case "goal_met":
        return "🎉";
      case "squad_reaction":
        return "🔥";
      case "squad_goal_met":
        return "🙌";
      case "workout_comment":
        return "💬";
      case "friend_request":
        return "👋";
      case "friend_acceptance":
        return "✅";
      default:
        return "📢";
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      onPress={() => onPress(notification)}
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: isUnread ? colors.surfaceMuted : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text style={{ fontSize: 24, marginRight: 12 }}>{getIcon()}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text
              style={{
                fontSize: 15,
                color: isUnread ? colors.textPrimary : colors.textSecondary,
                fontFamily: isUnread ? fontFamilies.semibold : fontFamilies.regular,
                flex: 1,
              }}
            >
              {notification.title}
            </Text>
            {isUnread && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 8 }} />
            )}
          </View>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
            {notification.body}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, opacity: 0.7 }}>
              {formatTime(notification.sent_at)}
            </Text>
            <TouchableOpacity
              onPress={() => onDelete(notification.id)}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ fontSize: 12, color: colors.error }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const NotificationInbox: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadNotifications = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await getNotificationInbox(50, 0);
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      console.error("[NotificationInbox] Error loading notifications:", err);
      // Don't show error for empty inbox - just show empty state
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleNotificationPress = async (notification: NotificationEvent) => {
    try {
      // Mark as clicked (which also marks as read)
      await markNotificationAsClicked(notification.id);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? {
                ...n,
                read_at: new Date().toISOString(),
                clicked_at: new Date().toISOString(),
              }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // TODO: Navigate based on notification type and data
      // For now, just mark as clicked
    } catch (error) {
      console.error("[NotificationInbox] Error handling notification press:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const deletedNotification = notifications.find((n) => n.id === id);
      if (deletedNotification && !deletedNotification.read_at) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("[NotificationInbox] Error deleting notification:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("[NotificationInbox] Error marking all as read:", error);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Mark all read button - only show when there are unread notifications */}
      {unreadCount > 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: "flex-end" }}>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ fontSize: 14, color: colors.primary }}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notification List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={handleNotificationPress}
            onDelete={handleDelete}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
            <Text style={{ fontSize: 18, color: colors.textSecondary, fontFamily: fontFamilies.semibold, textAlign: "center" }}>
              No notifications yet
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: "center", opacity: 0.7, lineHeight: 20 }}>
              When you receive goal reminders, streak nudges, or squad comments, they'll appear here
            </Text>
          </View>
        }
        contentContainerStyle={
          notifications.length === 0 ? { flexGrow: 1 } : undefined
        }
        style={{ flex: 1 }}
      />
    </View>
  );
};
