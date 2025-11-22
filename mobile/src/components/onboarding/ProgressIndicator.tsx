import { View, Text } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";

type ProgressIndicatorProps = {
  currentStep: number;
  totalSteps: number;
};

export const ProgressIndicator = ({
  currentStep,
  totalSteps,
}: ProgressIndicatorProps) => {
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                backgroundColor: isCompleted || isCurrent
                  ? colors.primary
                  : colors.border,
                opacity: isCompleted ? 1 : isCurrent ? 0.8 : 0.3,
              }}
            />
          );
        })}
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 12,
          fontFamily: fontFamilies.medium,
          textAlign: "center",
        }}
      >
        Step {currentStep + 1} of {totalSteps}
      </Text>
    </View>
  );
};
