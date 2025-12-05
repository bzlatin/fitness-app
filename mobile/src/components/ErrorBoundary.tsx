import React, { Component, ErrorInfo, ReactNode } from "react";
import { ScrollView, Text, View, TouchableOpacity, Platform } from "react-native";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingTop: Platform.OS === "ios" ? 60 : 40,
            paddingHorizontal: 20,
          }}
        >
          <Text
            style={{
              color: colors.error ?? "#f87171",
              fontSize: 20,
              fontFamily: fontFamilies.bold,
              marginBottom: 16,
            }}
          >
            Something went wrong
          </Text>

          <ScrollView style={{ flex: 1, marginBottom: 20 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontFamily: fontFamilies.medium,
                marginBottom: 8,
              }}
            >
              Error: {this.state.error?.message ?? "Unknown error"}
            </Text>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                fontFamily: fontFamilies.regular,
                marginBottom: 16,
              }}
            >
              {this.state.error?.stack ?? "No stack trace available"}
            </Text>

            {this.state.errorInfo?.componentStack && (
              <>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 14,
                    fontFamily: fontFamilies.medium,
                    marginBottom: 8,
                  }}
                >
                  Component Stack:
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    fontFamily: fontFamilies.regular,
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </Text>
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={this.handleRetry}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              marginBottom: 40,
            }}
          >
            <Text
              style={{
                color: colors.surface,
                textAlign: "center",
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
