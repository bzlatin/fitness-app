import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Image, Platform, Pressable, Switch, Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { shareWorkoutSummary, uploadProgressPhoto } from "../api/social";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootRoute } from "../navigation/types";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { Visibility } from "../types/social";
import { maybePromptForRatingAfterLoggedWorkout } from "../services/ratingPrompt";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getStoredLiveVisibility } from "../utils/liveVisibilityPreference";

const VisibilityToggle = ({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
}) => {
  const options: { value: Visibility; label: string; helper: string }[] = [
    { value: "private", label: "Private", helper: "Only you see\nthis." },
    { value: "followers", label: "Followers", helper: "Approved followers." },
    { value: "squad", label: "Squad", helper: "People in your squad." },
  ];

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ ...typography.title, color: colors.textPrimary }}>
        Share visibility
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active
                  ? "rgba(34,197,94,0.12)"
                  : colors.surfaceMuted,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  textAlign: "center",
                  color: active ? colors.primary : colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {option.label}
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  color: colors.textSecondary,
                  ...typography.caption,
                  marginTop: 4,
                }}
              >
                {option.helper}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          ...typography.caption,
          lineHeight: 18,
        }}
      >
        This controls who can see the workout summary. Photo sharing is separate
        and can stay private.
      </Text>
    </View>
  );
};

const PostWorkoutShareScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"PostWorkoutShare">>();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [visibility, setVisibility] = useState<Visibility>(
    route.params.initialVisibility ?? "squad"
  );
  const [progressPhotoUri, setProgressPhotoUri] = useState<
    string | undefined
  >();
  const [progressPhotoUploadedUrl, setProgressPhotoUploadedUrl] = useState<
    string | undefined
  >();
  const [sharePhotoPrivate, setSharePhotoPrivate] = useState(true);
  const appleHealthEnabled = user?.appleHealthEnabled === true;

  useEffect(() => {
    const timer = setTimeout(() => {
      void maybePromptForRatingAfterLoggedWorkout({ threshold: 3 });
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (route.params.initialVisibility) return;
      const stored = await getStoredLiveVisibility();
      if (cancelled || !stored) return;
      setVisibility(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params.initialVisibility]);

  const shareMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof shareWorkoutSummary>[0]) => {
      let progressPhotoUrl = payload.progressPhotoUri;
      const shouldUpload =
        Boolean(progressPhotoUrl) &&
        !progressPhotoUploadedUrl &&
        (progressPhotoUrl?.startsWith("file:") ||
          progressPhotoUrl?.startsWith("content:") ||
          progressPhotoUrl?.startsWith("ph:"));

      if (shouldUpload && progressPhotoUrl) {
        const uploaded = await uploadProgressPhoto(progressPhotoUrl);
        setProgressPhotoUploadedUrl(uploaded);
        progressPhotoUrl = uploaded;
      } else if (progressPhotoUploadedUrl) {
        progressPhotoUrl = progressPhotoUploadedUrl;
      }

      return shareWorkoutSummary({
        ...payload,
        progressPhotoUri: progressPhotoUrl,
        progressPhotoVisibility: progressPhotoUrl
          ? sharePhotoPrivate
            ? "private"
            : payload.visibility
          : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["progressPhotos", "me"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["social", "squad-feed"],
      });
      navigation.navigate("RootTabs", { screen: "History" });
    },
  });

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      setProgressPhotoUri(result.assets[0]?.uri);
      setProgressPhotoUploadedUrl(undefined);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      setProgressPhotoUri(result.assets[0]?.uri);
      setProgressPhotoUploadedUrl(undefined);
    }
  };

  const share = () => {
    if (visibility === "private" && !progressPhotoUri) {
      navigation.navigate("RootTabs", { screen: "History" });
      return;
    }
    shareMutation.mutate({
      sessionId: route.params.sessionId,
      visibility,
      templateName: route.params.templateName,
      totalSets: route.params.totalSets,
      totalVolume: route.params.totalVolume,
      prCount: route.params.prCount,
      progressPhotoUri,
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return undefined;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const summaryLineParts = [
    route.params.templateName ?? "Custom workout",
    route.params.durationSeconds
      ? formatDuration(route.params.durationSeconds)
      : undefined,
    route.params.totalSets ? `${route.params.totalSets} sets` : undefined,
    route.params.totalVolume ? `${route.params.totalVolume} lbs` : undefined,
    route.params.prCount ? `${route.params.prCount} PRs` : undefined,
  ].filter(Boolean);

  return (
    <ScreenContainer scroll includeTopInset={false} paddingTop={12}>
      <View style={{ gap: 16 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          Share this workout with your squad?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          You control who sees it. Progress pictures stay in the chosen circle.
        </Text>

        <View
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            Summary
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {summaryLineParts.join(" · ")}
          </Text>
        </View>

        {Platform.OS === "ios" ? (
          <View
            style={{
              padding: 16,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Apple Health (HealthKit)
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {appleHealthEnabled
                ? "Enabled — Push/Pull saves completed workouts to Apple Health (when permissions are granted)."
                : "Off — Turn this on in Settings to save completed workouts to Apple Health."}
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Settings")}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                Open Settings
              </Text>
            </Pressable>
          </View>
        ) : null}

        <VisibilityToggle value={visibility} onChange={setVisibility} />

        <View
          style={{
            gap: 8,
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            Optional progress picture
          </Text>
          {progressPhotoUri ? (
            <Image
              source={{ uri: progressPhotoUri }}
              style={{
                width: "100%",
                height: 200,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          ) : (
            <Text
              style={{ color: colors.textSecondary, ...typography.caption }}
            >
              Add a quick snap—by default it stays private. Toggle off to share
              it.
            </Text>
          )}

          {progressPhotoUri ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Photo privacy
                </Text>
                <Text
                  style={{ color: colors.textSecondary, ...typography.caption }}
                >
                  {sharePhotoPrivate
                    ? "Only you can see this photo."
                    : "Shared with the same audience as the summary."}
                </Text>
              </View>
              <Switch
                value={sharePhotoPrivate}
                onValueChange={setSharePhotoPrivate}
                thumbColor={sharePhotoPrivate ? colors.primary : undefined}
                trackColor={{
                  false: colors.border,
                  true: `${colors.primary}55`,
                }}
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={takePhoto}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {progressPhotoUri ? "Retake" : "Take photo"}
              </Text>
            </Pressable>
            <Pressable
              onPress={pickFromLibrary}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {progressPhotoUri ? "Choose another" : "Choose from library"}
              </Text>
            </Pressable>
          </View>

          {progressPhotoUri ? (
            <Pressable
              onPress={() => {
                setProgressPhotoUri(undefined);
                setProgressPhotoUploadedUrl(undefined);
                setSharePhotoPrivate(true);
              }}
              style={({ pressed }) => ({
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: colors.textSecondary }}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>

        {shareMutation.isError ? (
          <Text style={{ color: colors.error }}>
            Could not share right now. Save privately or try again.
          </Text>
        ) : null}

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={share}
            disabled={shareMutation.isPending}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.primary,
              opacity: pressed || shareMutation.isPending ? 0.86 : 1,
              shadowColor: colors.primary,
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
            })}
          >
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              {visibility === "private" ? "Save privately" : "Share"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              navigation.navigate("RootTabs", { screen: "History" })
            }
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.textSecondary }}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
};

export default PostWorkoutShareScreen;
