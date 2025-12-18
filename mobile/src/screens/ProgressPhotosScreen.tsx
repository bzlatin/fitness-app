import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import ScreenContainer from "../components/layout/ScreenContainer";
import { deleteMyProgressPhoto, getMyProgressPhotos } from "../api/social";
import { ProgressPhoto } from "../types/social";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import { RootNavigation } from "../navigation/RootNavigator";

type RangeKey = "all" | "30d" | "90d" | "1y";

const rangeDays: Record<Exclude<RangeKey, "all">, number> = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

const formatDay = (iso: string) => {
  const date = new Date(iso);
  const month = date.toLocaleString(undefined, { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
};

const formatYear = (iso: string) => new Date(iso).getFullYear();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const ProgressPhotosScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const queryClient = useQueryClient();
  const subscriptionAccess = useSubscriptionAccess();
  const [range, setRange] = useState<RangeKey>("all");
  const [selected, setSelected] = useState<ProgressPhoto | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["progressPhotos", "me"],
    queryFn: getMyProgressPhotos,
    enabled: subscriptionAccess.hasProAccess,
  });

  useFocusEffect(
    useCallback(() => {
      if (!subscriptionAccess.hasProAccess) return;
      void refetch();
    }, [refetch, subscriptionAccess.hasProAccess])
  );

  const deleteMutation = useMutation({
    mutationFn: deleteMyProgressPhoto,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["progressPhotos", "me"],
      });
    },
  });

  const filtered = useMemo(() => {
    const photos = data ?? [];
    if (range === "all") return photos;
    const days = rangeDays[range];
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return photos.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
  }, [data, range]);

  const modalControlsTop = Math.max(12, insets.top + 8);
  const modalImageMaxHeight = useMemo(() => {
    const available = windowHeight - insets.top - insets.bottom;
    return Math.min(340, Math.max(200, available * 0.48));
  }, [insets.bottom, insets.top, windowHeight]);

  const headerSubtitle = useMemo(() => {
    if (!filtered.length) return "Private timeline";
    const newest = filtered[0]?.createdAt;
    const oldest = filtered[filtered.length - 1]?.createdAt;
    if (!newest || !oldest) return "Private timeline";
    const newestYear = formatYear(newest);
    const oldestYear = formatYear(oldest);
    if (newestYear === oldestYear) {
      return `Private timeline · ${newestYear}`;
    }
    return `Private timeline · ${oldestYear}–${newestYear}`;
  }, [filtered]);

  const renderRangeChip = (key: RangeKey, label: string) => {
    const active = range === key;
    return (
      <Pressable
        key={key}
        onPress={() => setRange(key)}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? `${colors.primary}1A` : colors.surfaceMuted,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text
          style={{
            color: active ? colors.primary : colors.textSecondary,
            fontFamily: fontFamilies.semibold,
            fontSize: 12,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View
      style={{
        marginTop: 22,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 16,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: `${colors.primary}1A`,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: `${colors.primary}33`,
          }}
        >
          <Ionicons name='images' size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, ...typography.title }}>
            No progress photos yet
          </Text>
          <Text style={{ color: colors.textSecondary, ...typography.caption }}>
            Add one after a workout to start your private timeline.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderItem = ({
    item,
    index,
  }: {
    item: ProgressPhoto;
    index: number;
  }) => {
    const day = formatDay(item.createdAt);
    const time = formatTime(item.createdAt);
    const showRail = index !== filtered.length - 1;
    const title = item.templateName?.trim();
    const visibilityLabel =
      item.visibility && item.visibility !== "private"
        ? item.visibility === "followers"
          ? "Shared with followers"
          : "Shared with squad"
        : undefined;

    return (
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
        <View style={{ width: 70, alignItems: "flex-end" }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.semibold,
              fontSize: 12,
            }}
          >
            {day}
          </Text>
          <Text style={{ color: colors.textSecondary, ...typography.caption }}>
            {time}
          </Text>
        </View>

        <View style={{ width: 18, alignItems: "center" }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.background,
              marginTop: 4,
            }}
          />
          {showRail ? (
            <View
              style={{
                width: 2,
                flex: 1,
                backgroundColor: `${colors.border}AA`,
                marginTop: 6,
              }}
            />
          ) : null}
        </View>

        <Pressable
          onPress={() => setSelected(item)}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            transform: [{ scale: pressed ? 0.99 : 1 }],
            opacity: pressed ? 0.96 : 1,
          })}
        >
          <Image
            source={{ uri: item.imageUrl }}
            style={{
              width: "100%",
              aspectRatio: 3 / 4,
              backgroundColor: colors.surfaceMuted,
            }}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.55)"]}
            locations={[0, 0.55, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: 12,
              gap: 4,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.18)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name='lock-closed' size={12} color='white' />
                <Text
                  style={{
                    color: "white",
                    fontSize: 12,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Private
                </Text>
              </View>
              {visibilityLabel ? (
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                  {visibilityLabel}
                </Text>
              ) : null}
            </View>
            {title ? (
              <Text
                numberOfLines={1}
                style={{
                  color: "white",
                  fontFamily: fontFamilies.semibold,
                  fontSize: 14,
                }}
              >
                {title}
              </Text>
            ) : null}
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenContainer
        scroll
        includeTopInset={false}
        adjustScrollInsets
        paddingTop={36}
        showTopGradient
        showGradient
      >
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textPrimary, ...typography.heading1 }}>
              Progress photos
            </Text>
            <Text style={{ color: colors.textSecondary, ...typography.body }}>
              {headerSubtitle}
            </Text>
          </View>

          {!subscriptionAccess.hasProAccess ? (
            <View
              style={{
                marginTop: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: 16,
                gap: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: `${colors.primary}1A`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}33`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name='lock-closed'
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{ color: colors.textPrimary, ...typography.title }}
                  >
                    Pro feature
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      ...typography.caption,
                    }}
                  >
                    Keep a private timeline of your progress pictures over time.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => navigation.navigate("Upgrade")}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Upgrade to Pro
                </Text>
              </Pressable>
            </View>
          ) : null}

          {subscriptionAccess.hasProAccess ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {renderRangeChip("all", "All")}
              {renderRangeChip("30d", "30 days")}
              {renderRangeChip("90d", "90 days")}
              {renderRangeChip("1y", "1 year")}
            </View>
          ) : null}

          {subscriptionAccess.hasProAccess && isLoading ? (
            <View style={{ marginTop: 20 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          {subscriptionAccess.hasProAccess && !isLoading && isError ? (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Text style={{ color: colors.error }}>
                Could not load your progress photos right now.
              </Text>
              <Pressable
                onPress={() => refetch()}
                disabled={isRefetching}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                  opacity: pressed || isRefetching ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : null}

          {subscriptionAccess.hasProAccess &&
          !isLoading &&
          !isError &&
          filtered.length === 0
            ? renderEmpty()
            : null}

          {subscriptionAccess.hasProAccess &&
          !isLoading &&
          !isError &&
          filtered.length > 0 ? (
            <FlatList
              data={filtered}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingTop: 8 }}
            />
          ) : null}
        </View>
      </ScreenContainer>

      <Modal visible={Boolean(selected)} transparent animationType='fade'>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => setSelected(null)}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.92)",
            }}
          />

          <SafeAreaView style={{ flex: 1 }} pointerEvents='box-none'>
            <View
              pointerEvents='box-none'
              style={{
                flex: 1,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: Math.max(insets.bottom, 16),
                justifyContent: "center",
              }}
            >
              <View
                pointerEvents='auto'
                style={{
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.10)",
                  overflow: "hidden",
                }}
              >
                {selected ? (
                  <View style={{ padding: 12, gap: 10 }}>
                    <View style={{ gap: 2 }}>
                      <Text
                        style={{
                          color: "white",
                          fontFamily: fontFamilies.semibold,
                          fontSize: 16,
                        }}
                      >
                        {formatDay(selected.createdAt)}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          fontSize: 12,
                        }}
                      >
                        {formatTime(selected.createdAt)}
                      </Text>
                    </View>

                    <View
                      style={{
                        width: "100%",
                        maxHeight: modalImageMaxHeight,
                        borderRadius: 14,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        source={{ uri: selected.imageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode='contain'
                      />
                    </View>

                    {selected.templateName ? (
                      <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                        {selected.templateName}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View
                pointerEvents='auto'
                style={{
                  position: "absolute",
                  top: modalControlsTop,
                  right: 16,
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (!selected) return;
                    Alert.alert(
                      "Delete progress photo?",
                      "This removes it from your timeline.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => {
                            const id = selected.id;
                            setSelected(null);
                            deleteMutation.mutate(id);
                          },
                        },
                      ]
                    );
                  }}
                  disabled={!selected || deleteMutation.isPending}
                  hitSlop={12}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: pressed
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(255,255,255,0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed || deleteMutation.isPending ? 0.88 : 1,
                  })}
                >
                  <Ionicons name='trash' size={20} color='white' />
                </Pressable>

                <Pressable
                  onPress={() => setSelected(null)}
                  hitSlop={12}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: pressed
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(255,255,255,0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Ionicons name='close' size={22} color='white' />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

export default ProgressPhotosScreen;
