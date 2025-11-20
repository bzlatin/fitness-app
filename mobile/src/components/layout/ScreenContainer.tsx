import { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

type Props = {
  children: ReactNode;
  scroll?: boolean;
};

const ScreenContainer = ({ children, scroll = false }: Props) => {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Wrapper
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
        contentContainerStyle={scroll ? { paddingBottom: 24 } : undefined}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
};

export default ScreenContainer;
