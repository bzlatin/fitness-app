import { NavigatorScreenParams, RouteProp } from "@react-navigation/native";

export type RootStackParamList = {
  RootTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  WorkoutTemplateDetail: { templateId: string };
  WorkoutTemplateBuilder: { templateId?: string };
  WorkoutGenerator: undefined;
  WorkoutSession: { templateId: string; sessionId?: string; initialVisibility?: Visibility };
  Profile: { userId: string };
  PostWorkoutShare: {
    sessionId: string;
    templateId?: string;
    templateName?: string;
    totalSets?: number;
    totalVolume?: number;
    prCount?: number;
  };
  WorkoutPreview: {
    workout: {
      name: string;
      splitType?: string;
      exercises: any[];
      reasoning: string;
      estimatedDurationMinutes: number;
    };
  };
  Onboarding: { isRetake?: boolean };
  SquadJoin: { code: string };
  Recovery: undefined;
};

export type RootTabParamList = {
  Home: { selectedTemplateId?: string } | undefined;
  Squad: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootRoute<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;
import { Visibility } from "../types/social";
