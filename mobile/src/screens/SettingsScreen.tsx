import { Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";

const SettingsScreen = () => (
  <ScreenContainer>
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
        Settings
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        Units, theme, and account settings coming later.
      </Text>
    </View>
  </ScreenContainer>
);

export default SettingsScreen;
