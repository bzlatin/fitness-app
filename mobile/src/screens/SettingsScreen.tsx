import { Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import { useAuth } from "../context/AuthContext";

const SettingsScreen = () => {
  const { logout, isAuthorizing } = useAuth();

  return (
    <ScreenContainer>
      <View style={{ marginTop: 16, gap: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "700" }}>
          Settings
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Units, theme, and more account settings coming soon.
        </Text>
        <View
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            gap: 12,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 16,
            }}
          >
            Account
          </Text>
          <TouchableOpacity
            onPress={logout}
            disabled={isAuthorizing}
            style={{
              paddingVertical: 12,
              borderRadius: 999,
              backgroundColor: isAuthorizing ? colors.border : colors.primary,
            }}
          >
            <Text
              style={{
                textAlign: "center",
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              {isAuthorizing ? "Signing out..." : "Sign out"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
};

export default SettingsScreen;
