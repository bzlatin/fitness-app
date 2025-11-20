import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import SetEditorRow from "../components/workouts/SetEditorRow";
import {
  completeSession,
  fetchSession,
  startSessionFromTemplate,
} from "../api/sessions";
import { RootRoute } from "../navigation/types";
import { colors } from "../theme/colors";
import { WorkoutSet } from "../types/workouts";
import { useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WorkoutSessionScreen = () => {
  const route = useRoute<RootRoute<"WorkoutSession">>();
  const navigation = useNavigation<Nav>();
  const [sessionId, setSessionId] = useState(route.params.sessionId);
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchSession(sessionId!),
    onSuccess: (data) => setSets(data.sets),
  });

  const startMutation = useMutation({
    mutationFn: () => startSessionFromTemplate(route.params.templateId),
    onSuccess: (session) => {
      setSessionId(session.id);
      setSets(session.sets);
    },
    onError: () =>
      Alert.alert("Could not start session", "Please try again."),
  });

  useEffect(() => {
    if (!route.params.sessionId) {
      startMutation.mutate();
    }
  }, []);

  const finishMutation = useMutation({
    mutationFn: () => completeSession(sessionId!, sets),
    onSuccess: () => {
      Alert.alert("Workout saved", undefined, [
        {
          text: "Done",
          onPress: () => navigation.navigate("RootTabs"),
        },
      ]);
    },
    onError: () => Alert.alert("Could not finish workout"),
  });

  const updateSet = (updated: WorkoutSet) => {
    setSets((prev) => prev.map((set) => (set.id === updated.id ? updated : set)));
  };

  const sessionTitle = sessionQuery.data?.templateId
    ? "Workout Session"
    : "Active Session";

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          {sessionTitle}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Log your sets below. Targets are prefilled from the template.
        </Text>

        {sets.map((set) => (
          <SetEditorRow key={set.id} set={set} onChange={updateSet} />
        ))}

        <Pressable
          disabled={!sessionId}
          onPress={() => finishMutation.mutate()}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 12,
            marginBottom: 24,
            opacity: !sessionId || pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: "#0B1220", fontWeight: "800", fontSize: 16 }}>
            Finish Workout
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

export default WorkoutSessionScreen;
