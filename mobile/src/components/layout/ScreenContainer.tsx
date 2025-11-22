import { ReactNode, useState } from "react";
import { ScrollView, StatusBar, View, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showGradient?: boolean; // Override to force show/hide gradient
};

const ScreenContainer = ({ children, scroll = false, showGradient }: Props) => {
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(false);

  const Wrapper = scroll ? ScrollView : View;

  // Only show gradient if content is scrollable and not at bottom
  const isScrollable = contentHeight > scrollViewHeight;
  const shouldShowGradient = showGradient !== undefined
    ? showGradient
    : scroll && isScrollable && !isNearBottom;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setIsNearBottom(distanceFromBottom < 10);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={{ flex: 1 }}>
        <Wrapper
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
          contentContainerStyle={scroll ? { paddingBottom: Math.max(insets.bottom, 20) + 60 } : undefined}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scroll ? (w, h) => setContentHeight(h) : undefined}
          onLayout={scroll ? (e: LayoutChangeEvent) => setScrollViewHeight(e.nativeEvent.layout.height) : undefined}
          onScroll={scroll ? handleScroll : undefined}
          scrollEventThrottle={16}
        >
          {children}
        </Wrapper>
        {shouldShowGradient && (
          <LinearGradient
            colors={[
              'transparent',
              `${colors.background}10`,
              `${colors.background}30`,
              `${colors.background}60`,
              `${colors.background}90`,
              `${colors.background}C0`,
              `${colors.background}E0`,
              colors.background,
            ]}
            locations={[0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 60 + insets.bottom,
              pointerEvents: 'none',
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default ScreenContainer;
