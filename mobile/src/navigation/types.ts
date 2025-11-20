import { RouteProp } from "@react-navigation/native";

export type RootStackParamList = {
  RootTabs: undefined;
  WorkoutTemplateDetail: { templateId: string };
  WorkoutTemplateBuilder: { templateId?: string };
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
};

export type RootTabParamList = {
  Home: undefined;
  Squad: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootRoute<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;
import { Visibility } from "../types/social";
