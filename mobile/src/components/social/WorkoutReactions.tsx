import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../theme/colors";
import { typography, fontFamilies } from "../../theme/typography";
import {
  addReaction,
  removeReaction,
  addComment,
  deleteComment,
  getReactions,
} from "../../api/social";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { EmojiReaction, WorkoutComment } from "../../types/social";
import { RootNavigation } from "../../navigation/RootNavigator";

const EMOJI_OPTIONS = ["🔥", "💪", "🚀", "🙌", "❤️", "👏"];

const initialsForName = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const formatRelativeTime = (iso: string) => {
  const created = new Date(iso);
  const diffMs = Date.now() - created.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

type Props = {
  targetType: "status" | "share";
  targetId: string;
  compact?: boolean;
  ownerUserId?: string;
};

export const WorkoutReactions = ({
  targetType,
  targetId,
  compact = true,
  ownerUserId,
}: Props) => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const navigation = useNavigation<RootNavigation>();
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [newComment, setNewComment] = useState("");

  const reactionsQuery = useQuery({
    queryKey: ["social", "reactions", targetType, targetId],
    queryFn: () => getReactions(targetType, targetId),
    staleTime: 30000,
  });

  const addReactionMutation = useMutation({
    mutationFn: ({ emoji }: { emoji: string }) =>
      addReaction(targetType, targetId, emoji),
    onMutate: async ({ emoji }) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: ["social", "reactions", targetType, targetId],
      });
      const previous = queryClient.getQueryData(["social", "reactions", targetType, targetId]);
      queryClient.setQueryData(
        ["social", "reactions", targetType, targetId],
        (old: { emojis: EmojiReaction[]; comments: WorkoutComment[] } | undefined) => {
          if (!old) return { emojis: [{ emoji, count: 1, hasReacted: true }], comments: [] };
          const existing = old.emojis.find((e) => e.emoji === emoji);
          if (existing) {
            return {
              ...old,
              emojis: old.emojis.map((e) =>
                e.emoji === emoji
                  ? { ...e, count: e.count + 1, hasReacted: true }
                  : e
              ),
            };
          }
          return {
            ...old,
            emojis: [...old.emojis, { emoji, count: 1, hasReacted: true }],
          };
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["social", "reactions", targetType, targetId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["social", "reactions", targetType, targetId],
      });
    },
  });

  const removeReactionMutation = useMutation({
    mutationFn: ({ emoji }: { emoji: string }) =>
      removeReaction(targetType, targetId, emoji),
    onMutate: async ({ emoji }) => {
      await queryClient.cancelQueries({
        queryKey: ["social", "reactions", targetType, targetId],
      });
      const previous = queryClient.getQueryData(["social", "reactions", targetType, targetId]);
      queryClient.setQueryData(
        ["social", "reactions", targetType, targetId],
        (old: { emojis: EmojiReaction[]; comments: WorkoutComment[] } | undefined) => {
          if (!old) return { emojis: [], comments: [] };
          return {
            ...old,
            emojis: old.emojis
              .map((e) =>
                e.emoji === emoji
                  ? { ...e, count: e.count - 1, hasReacted: false }
                  : e
              )
              .filter((e) => e.count > 0),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["social", "reactions", targetType, targetId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["social", "reactions", targetType, targetId],
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ comment }: { comment: string }) =>
      addComment(targetType, targetId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["social", "reactions", targetType, targetId],
      });
      setNewComment("");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: ({ commentId }: { commentId: string }) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["social", "reactions", targetType, targetId],
      });
    },
  });

  const handleViewProfile = useCallback(
    (profileUserId: string) => {
      if (!profileUserId) return;
      setShowCommentsModal(false);
      navigation.navigate("UserProfile", { userId: profileUserId });
    },
    [navigation]
  );

  const requestDeleteComment = useCallback(
    (commentId: string) => {
      Alert.alert("Delete this comment?", undefined, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteCommentMutation.mutate({ commentId }),
        },
      ]);
    },
    [deleteCommentMutation]
  );

  const handleEmojiPress = useCallback(
    (emoji: string, hasReacted: boolean) => {
      if (hasReacted) {
        removeReactionMutation.mutate({ emoji });
      } else {
        addReactionMutation.mutate({ emoji });
      }
    },
    [addReactionMutation, removeReactionMutation]
  );

  const handleSubmitComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    addCommentMutation.mutate({ comment: trimmed });
  };

  const emojis = reactionsQuery.data?.emojis ?? [];
  const comments = reactionsQuery.data?.comments ?? [];
  const commentCount = comments.length;

  // Find which emojis the user has reacted with
  const userReactedEmojis = new Set(
    emojis.filter((e) => e.hasReacted).map((e) => e.emoji)
  );

  if (compact) {
    // Compact inline view for feed cards
    return (
      <View style={{ marginTop: 10, gap: 8 }}>
        {/* Emoji reaction bar */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {EMOJI_OPTIONS.map((emoji) => {
            const reaction = emojis.find((e) => e.emoji === emoji);
            const hasReacted = userReactedEmojis.has(emoji);
            const count = reaction?.count ?? 0;

            return (
              <Pressable
                key={emoji}
                onPress={() => handleEmojiPress(emoji, hasReacted)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: hasReacted
                    ? "rgba(34,197,94,0.15)"
                    : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderWidth: 1,
                  borderColor: hasReacted ? colors.primary : colors.border,
                })}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                {count > 0 && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: hasReacted ? colors.primary : colors.textSecondary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Comments button */}
        <Pressable
          onPress={() => setShowCommentsModal(true)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, ...typography.caption }}>
            {commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? "s" : ""}` : "Add a comment"}
          </Text>
        </Pressable>

        {/* Comments Modal */}
        <CommentsModal
          visible={showCommentsModal}
          onClose={() => setShowCommentsModal(false)}
          comments={comments}
          newComment={newComment}
          onChangeComment={setNewComment}
          onSubmitComment={handleSubmitComment}
          onRequestDelete={requestDeleteComment}
          onPressProfile={handleViewProfile}
          isSubmitting={addCommentMutation.isPending}
          isDeleting={deleteCommentMutation.isPending}
          currentUserId={user?.id}
          ownerUserId={ownerUserId}
        />
      </View>
    );
  }

  // Full view (for detail screens)
  return (
    <View style={{ gap: 16 }}>
      {/* Emoji reactions */}
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Reactions
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {EMOJI_OPTIONS.map((emoji) => {
            const reaction = emojis.find((e) => e.emoji === emoji);
            const hasReacted = userReactedEmojis.has(emoji);
            const count = reaction?.count ?? 0;

            return (
              <Pressable
                key={emoji}
                onPress={() => handleEmojiPress(emoji, hasReacted)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: hasReacted
                    ? "rgba(34,197,94,0.15)"
                    : pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderWidth: 1,
                  borderColor: hasReacted ? colors.primary : colors.border,
                })}
              >
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
                {count > 0 && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: hasReacted ? colors.primary : colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Comments section */}
      <View style={{ gap: 12 }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Comments ({commentCount})
        </Text>

        {/* Comment input */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              flex: 1,
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: fontFamilies.regular,
              maxHeight: 100,
            }}
          />
          <Pressable
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || addCommentMutation.isPending}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || !newComment.trim() || addCommentMutation.isPending ? 0.7 : 1,
            })}
          >
            {addCommentMutation.isPending ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={colors.surface} />
            )}
          </Pressable>
        </View>

        {/* Comments list */}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={user?.id}
            onDelete={requestDeleteComment}
            isDeleting={deleteCommentMutation.isPending}
            onPressProfile={handleViewProfile}
            ownerUserId={ownerUserId}
          />
        ))}
      </View>
    </View>
  );
};

type CommentsModalProps = {
  visible: boolean;
  onClose: () => void;
  comments: WorkoutComment[];
  newComment: string;
  onChangeComment: (text: string) => void;
  onSubmitComment: () => void;
  onRequestDelete: (commentId: string) => void;
  onPressProfile: (userId: string) => void;
  isSubmitting: boolean;
  isDeleting: boolean;
  currentUserId?: string;
  ownerUserId?: string;
};

const CommentsModal = ({
  visible,
  onClose,
  comments,
  newComment,
  onChangeComment,
  onSubmitComment,
  onRequestDelete,
  onPressProfile,
  isSubmitting,
  isDeleting,
  currentUserId,
  ownerUserId,
}: CommentsModalProps) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <Pressable
      onPress={onClose}
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "80%",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Comments ({comments.length})
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                Close
              </Text>
            </Pressable>
          </View>

          {/* Comments list */}
          <ScrollView
            style={{ maxHeight: 400 }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
          >
            {comments.length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 20 }}>
                No comments yet. Be the first to comment!
              </Text>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={onRequestDelete}
                  isDeleting={isDeleting}
                  onPressProfile={onPressProfile}
                  ownerUserId={ownerUserId}
                />
              ))
            )}
          </ScrollView>

          {/* Comment input */}
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <TextInput
              value={newComment}
              onChangeText={onChangeComment}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{
                flex: 1,
                backgroundColor: colors.surfaceMuted,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontFamily: fontFamilies.regular,
                maxHeight: 100,
              }}
            />
            <Pressable
              onPress={onSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed || !newComment.trim() || isSubmitting ? 0.7 : 1,
              })}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={colors.surface} />
              )}
            </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  </Modal>
);

type CommentItemProps = {
  comment: WorkoutComment;
  currentUserId?: string;
  onDelete: (commentId: string) => void;
  onPressProfile: (userId: string) => void;
  isDeleting: boolean;
  ownerUserId?: string;
};

const CommentItem = ({
  comment,
  currentUserId,
  onDelete,
  onPressProfile,
  isDeleting,
  ownerUserId,
}: CommentItemProps) => {
  const canDelete =
    currentUserId !== undefined &&
    (comment.user.id === currentUserId || ownerUserId === currentUserId);

  const handleLongPress = () => {
    const options = ["Cancel", "View Profile"];
    const actions: Array<(() => void) | undefined> = [
      undefined,
      () => onPressProfile(comment.user.id),
    ];

    if (canDelete) {
      options.push("Delete");
      actions.push(() => onDelete(comment.id));
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: canDelete ? options.length - 1 : undefined,
        },
        (buttonIndex) => {
          const action = actions[buttonIndex];
          action?.();
        }
      );
      return;
    }

    Alert.alert("Comment options", undefined, [
      { text: "View Profile", onPress: () => onPressProfile(comment.user.id) },
      ...(canDelete
        ? [
            {
              text: "Delete",
              style: "destructive" as const,
              onPress: () => onDelete(comment.id),
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={220}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 10,
        padding: 10,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.95 : 1,
      })}
    >
      <Pressable
        onPress={() => onPressProfile(comment.user.id)}
        hitSlop={6}
        style={{ alignSelf: "flex-start" }}
      >
        {comment.user.avatarUrl ? (
          <Image
            source={{ uri: comment.user.avatarUrl }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: colors.surface,
            }}
          />
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                fontFamily: fontFamilies.semibold,
              }}
            >
              {initialsForName(comment.user.name)}
            </Text>
          </View>
        )}
      </Pressable>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <Pressable
            onPress={() => onPressProfile(comment.user.id)}
            hitSlop={4}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text
              style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 13 }}
              numberOfLines={1}
            >
              {comment.user.name}
            </Text>
          </Pressable>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
          {canDelete ? (
            <Pressable
              onPress={() => onDelete(comment.id)}
              disabled={isDeleting}
              hitSlop={8}
              style={({ pressed }) => ({
                marginLeft: "auto",
                opacity: pressed || isDeleting ? 0.5 : 1,
              })}
            >
              <Text style={{ fontSize: 12 }}>🗑️</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: colors.textPrimary, marginTop: 2 }}>
          {comment.comment}
        </Text>
      </View>
    </Pressable>
  );
};

export default WorkoutReactions;
