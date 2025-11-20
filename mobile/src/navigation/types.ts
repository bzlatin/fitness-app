import { RouteProp } from "@react-navigation/native";

export type RootStackParamList = {
  RootTabs: undefined;
  WorkoutTemplateDetail: { templateId: string };
  WorkoutTemplateBuilder: { templateId?: string };
  WorkoutSession: { templateId: string; sessionId?: string };
};

export type RootTabParamList = {
  Today: undefined;
  MyWorkouts: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootRoute<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;
