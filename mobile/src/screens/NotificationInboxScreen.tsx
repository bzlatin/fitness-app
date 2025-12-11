import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { NotificationInbox } from "../components/notifications/NotificationInbox";

const NotificationInboxScreen: React.FC = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
      <View style={{ flex: 1 }}>
        <NotificationInbox />
      </View>
    </SafeAreaView>
  );
};

export default NotificationInboxScreen;
