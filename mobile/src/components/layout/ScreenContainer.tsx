import { forwardRef, ReactNode, useState } from "react";
import {
  ScrollView,
  StatusBar,
  View,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import {
  Edge,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showGradient?: boolean; // Override to force show/hide gradient
  showTopGradient?: boolean; // Override to force show/hide top gradient
  paddingTop?: number; // Override top padding on the scroll/view wrapper
  includeTopInset?: boolean; // Disable top safe area when native header already provides it
  refreshControl?: ReactNode;
  adjustScrollInsets?: boolean; // Disable automatic nav inset adjustments when header already offsets content
  bottomOverlay?: ReactNode; // Fixed overlay rendered above content (e.g. sticky save bar)
};

const ScreenContainer = forwardRef<ScrollView, Props>(({
  children,
  scroll = false,
  showGradient,
  showTopGradient,
  paddingTop = 16,
  includeTopInset = true,
  refreshControl,
  adjustScrollInsets = true,
  bottomOverlay,
}, ref) => {
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [isNearTop, setIsNearTop] = useState(true);

  const safeEdges: Edge[] = includeTopInset
    ? ["top", "left", "right"]
    : ["left", "right"];

  // Only show gradient if content is scrollable
  const isScrollable = contentHeight > scrollViewHeight;
  const shouldShowBottomGradient =
    showGradient !== undefined
      ? showGradient
      : scroll && isScrollable && !isNearBottom;
  const shouldShowTopGradient =
    showTopGradient !== undefined
      ? showTopGradient
      : scroll && isScrollable && !isNearTop;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    const distanceFromTop = contentOffset.y;

    setIsNearTop(distanceFromTop < 10);
    setIsNearBottom(distanceFromBottom < 50);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={safeEdges}
    >
      <StatusBar barStyle='light-content' backgroundColor={colors.background} />
      <View style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            ref={ref}
            style={{ flex: 1, paddingHorizontal: 16, paddingTop }}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 120 }}
            contentInsetAdjustmentBehavior={adjustScrollInsets ? "automatic" : "never"}
            automaticallyAdjustsScrollIndicatorInsets={adjustScrollInsets}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={(w, h) => setContentHeight(h)}
            onLayout={(e: LayoutChangeEvent) => setScrollViewHeight(e.nativeEvent.layout.height)}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={refreshControl as any}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop }}>
            {children}
          </View>
        )}
        {bottomOverlay ? (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 20,
            }}
          >
            {bottomOverlay}
          </View>
        ) : null}
        {shouldShowTopGradient && (
          <LinearGradient
            colors={[
              colors.background,
              `${colors.background}E0`,
              `${colors.background}C0`,
              `${colors.background}90`,
              `${colors.background}60`,
              `${colors.background}30`,
              `${colors.background}10`,
              "transparent",
            ]}
            locations={[0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 80,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
        )}
        {shouldShowBottomGradient && (
          <LinearGradient
            colors={[
              "transparent",
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
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80 + insets.bottom,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
});

ScreenContainer.displayName = "ScreenContainer";

export default ScreenContainer;
