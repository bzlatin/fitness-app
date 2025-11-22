import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { shareWorkoutSummary } from "../api/social";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootRoute } from "../navigation/types";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { Visibility } from "../types/social";

const VisibilityToggle = ({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
}) => {
  const options: { value: Visibility; label: string; helper: string }[] = [
    { value: "private", label: "Private", helper: "Only you see this." },
    { value: "followers", label: "Followers", helper: "Approved followers." },
    { value: "squad", label: "Squad", helper: "People in your squad." },
  ];

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ ...typography.title, color: colors.textPrimary }}>
        Visibility
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
                backgroundColor: active ? "rgba(34,197,94,0.12)" : colors.surfaceMuted,
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
    </View>
  );
};

const PostWorkoutShareScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"PostWorkoutShare">>();
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [progressPhotoUri, setProgressPhotoUri] = useState<string | undefined>();

  const shareMutation = useMutation({
    mutationFn: shareWorkoutSummary,
    onSuccess: () => navigation.navigate("RootTabs", { screen: "History" }),
  });

  const requestPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setProgressPhotoUri(result.assets[0]?.uri);
    }
  };

  const share = () => {
    if (visibility === "private") {
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

  const summaryLineParts = [
    route.params.templateName ?? "Custom workout",
    route.params.totalSets ? `${route.params.totalSets} sets` : undefined,
    route.params.totalVolume ? `${route.params.totalVolume} volume` : undefined,
    route.params.prCount ? `${route.params.prCount} PRs` : undefined,
  ].filter(Boolean);

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 16, marginTop: 8 }}>
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
            <Text style={{ color: colors.textSecondary, ...typography.caption }}>
              Add a quick snap—only people in this visibility group will see it.
            </Text>
          )}

          <Pressable
            onPress={requestPhoto}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              {progressPhotoUri ? "Change photo" : "Add progress picture"}
            </Text>
          </Pressable>
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
            onPress={() => navigation.navigate("RootTabs", { screen: "History" })}
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
