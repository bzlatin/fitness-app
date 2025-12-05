import { useState, useCallback } from "react";
import {
  ActivityIndicator,
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
import { SocialUserSummary, EmojiReaction, WorkoutComment } from "../../types/social";
import { formatHandle } from "../../utils/formatHandle";

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
};

export const WorkoutReactions = ({ targetType, targetId, compact = true }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
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
          onDeleteComment={(commentId) => deleteCommentMutation.mutate({ commentId })}
          isSubmitting={addCommentMutation.isPending}
          isDeleting={deleteCommentMutation.isPending}
          currentUserId={user?.id}
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
            onDelete={() => deleteCommentMutation.mutate({ commentId: comment.id })}
            isDeleting={deleteCommentMutation.isPending}
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
  onDeleteComment: (commentId: string) => void;
  isSubmitting: boolean;
  isDeleting: boolean;
  currentUserId?: string;
};

const CommentsModal = ({
  visible,
  onClose,
  comments,
  newComment,
  onChangeComment,
  onSubmitComment,
  onDeleteComment,
  isSubmitting,
  isDeleting,
  currentUserId,
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
                  onDelete={() => onDeleteComment(comment.id)}
                  isDeleting={isDeleting}
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
  onDelete: () => void;
  isDeleting: boolean;
};

const CommentItem = ({ comment, currentUserId, onDelete, isDeleting }: CommentItemProps) => {
  const isOwn = comment.user.id === currentUserId;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 10,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
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
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fontFamilies.semibold }}>
            {initialsForName(comment.user.name)}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 13 }}>
            {comment.user.name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>
        <Text style={{ color: colors.textPrimary, marginTop: 2 }}>
          {comment.comment}
        </Text>
      </View>
      {isOwn && (
        <Pressable
          onPress={onDelete}
          disabled={isDeleting}
          style={({ pressed }) => ({
            padding: 4,
            opacity: pressed || isDeleting ? 0.5 : 1,
          })}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
};

export default WorkoutReactions;
