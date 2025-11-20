import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationProp, RouteProp } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { colors } from "../theme/colors";
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

const TabLabel = ({ text, focused }: { text: string; focused: boolean }) => (
  <View>
    <Text
      style={{
        color: focused ? colors.primary : colors.textSecondary,
        fontWeight: focused ? "700" : "500",
      }}
    >
      {text}
    </Text>
  </View>
);

const RootTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.surfaceMuted,
        borderTopColor: colors.border,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
    }}
  >
    <Tab.Screen
      name="Today"
      component={TodayScreen}
      options={{
        tabBarLabel: ({ focused }) => <TabLabel text="Today" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="MyWorkouts"
      component={MyWorkoutsScreen}
      options={{
        tabBarLabel: ({ focused }) => (
          <TabLabel text="My Workouts" focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="History"
      component={HistoryScreen}
      options={{
        tabBarLabel: ({ focused }) => (
          <TabLabel text="History" focused={focused} />
        ),
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        tabBarLabel: ({ focused }) => (
          <TabLabel text="Settings" focused={focused} />
        ),
      }}
    />
  </Tab.Navigator>
);

const RootNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.surfaceMuted },
      headerTintColor: colors.textPrimary,
      contentStyle: { backgroundColor: colors.background },
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
