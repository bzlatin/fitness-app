import { Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";

const HistoryScreen = () => (
  <ScreenContainer>
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
        History
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        Sessions history will live here soon.
      </Text>
    </View>
  </ScreenContainer>
);

export default HistoryScreen;
