import { NavigatorScreenParams, RouteProp } from "@react-navigation/native";

export type RootStackParamList = {
  RootTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  WorkoutTemplateDetail: { templateId: string };
  WorkoutTemplateBuilder: { templateId?: string };
  WorkoutGenerator: undefined;
  WorkoutSession: { templateId: string; sessionId?: string; initialVisibility?: Visibility };
  UserProfile: { userId: string };
  PostWorkoutShare: {
    sessionId: string;
    templateId?: string;
    templateName?: string;
    totalSets?: number;
    totalVolume?: number;
    prCount?: number;
    durationSeconds?: number;
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
  SquadDetail: { squadId: string };
  SquadSettings: { squadId: string };
  Recovery: undefined;
  Analytics: undefined;
  Upgrade: { plan?: "monthly" | "annual" } | undefined;
  NotificationInbox: undefined;
  Settings: { openConnections?: boolean } | undefined;
};

export type RootTabParamList = {
  Home: { selectedTemplateId?: string } | undefined;
  Squad: { openFindBuddies?: boolean } | undefined;
  History: undefined;
  Profile: undefined;
};

export type RootRoute<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;
import { Visibility } from "../types/social";
