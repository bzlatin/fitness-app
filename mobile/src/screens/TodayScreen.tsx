import { Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";

const TodayScreen = () => (
  <ScreenContainer>
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
        Today
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        Quick start: head to My Workouts to load a template.
      </Text>
    </View>
  </ScreenContainer>
);

export default TodayScreen;
