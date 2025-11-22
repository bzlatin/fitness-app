import { ReactNode } from "react";
import { ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";

type Props = {
  children: ReactNode;
  scroll?: boolean;
};

const ScreenContainer = ({ children, scroll = false }: Props) => {
  const insets = useSafeAreaInsets();
  const Wrapper = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={{ flex: 1 }}>
        <Wrapper
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
          contentContainerStyle={scroll ? { paddingBottom: Math.max(insets.bottom, 20) + 60 } : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </Wrapper>
        {scroll && (
          <LinearGradient
            colors={['transparent', `${colors.background}CC`, colors.background]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 80 + insets.bottom,
              pointerEvents: 'none',
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default ScreenContainer;
