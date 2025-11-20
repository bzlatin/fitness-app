import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationProp, RouteProp } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import TodayScreen from "../screens/TodayScreen";
import MyWorkoutsScreen from "../screens/MyWorkoutsScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import WorkoutTemplateDetailScreen from "../screens/WorkoutTemplateDetailScreen";
import WorkoutTemplateBuilderScreen from "../screens/WorkoutTemplateBuilderScreen";
import WorkoutSessionScreen from "../screens/WorkoutSessionScreen";
import { RootStackParamList, RootTabParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const tabIconMap: Record<
  keyof RootTabParamList,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Today: { focused: "calendar", unfocused: "calendar-outline" },
  MyWorkouts: { focused: "barbell", unfocused: "barbell-outline" },
  History: { focused: "time", unfocused: "time-outline" },
  Settings: { focused: "settings", unfocused: "settings-outline" },
};

const RootTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        height: 70,
        paddingTop: 8,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: "#6B7280",
      tabBarLabelStyle: {
        fontFamily: fontFamilies.medium,
        fontSize: 12,
      },
      tabBarIcon: ({ color, size, focused }) => {
        const config = tabIconMap[route.name as keyof RootTabParamList];
        const iconName = focused ? config.focused : config.unfocused;
        return <Ionicons name={iconName} size={size + 2} color={color} />;
      },
    })}
  >
    <Tab.Screen
      name="Today"
      component={TodayScreen}
      options={{ tabBarLabel: "Today" }}
    />
    <Tab.Screen
      name="MyWorkouts"
      component={MyWorkoutsScreen}
      options={{ tabBarLabel: "My Workouts" }}
    />
    <Tab.Screen
      name="History"
      component={HistoryScreen}
      options={{ tabBarLabel: "History" }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ tabBarLabel: "Settings" }}
    />
  </Tab.Navigator>
);

const RootNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.surfaceMuted },
      headerTintColor: colors.textPrimary,
      contentStyle: { backgroundColor: colors.background },
      headerTitleStyle: { fontFamily: fontFamilies.semibold },
      headerBackTitle: "Back",
    }}
  >
    <Stack.Screen
      name="RootTabs"
      component={RootTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="WorkoutTemplateDetail"
      component={WorkoutTemplateDetailScreen}
      options={{ title: "Template" }}
    />
    <Stack.Screen
      name="WorkoutTemplateBuilder"
      component={WorkoutTemplateBuilderScreen}
      options={{ title: "Build Workout" }}
    />
    <Stack.Screen
      name="WorkoutSession"
      component={WorkoutSessionScreen}
      options={{ title: "Workout Session" }}
    />
  </Stack.Navigator>
);

export default RootNavigator;

export type RootNavigation = NavigationProp<RootStackParamList>;
export type RootRoute<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;
