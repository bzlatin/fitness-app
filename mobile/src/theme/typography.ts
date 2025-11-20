export const fontFamilies = {
  regular: "SpaceGrotesk-Regular",
  medium: "SpaceGrotesk-Medium",
  semibold: "SpaceGrotesk-SemiBold",
  bold: "SpaceGrotesk-Bold",
};

export const typography = {
  heading1: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  heading2: {
    fontFamily: fontFamilies.semibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
};

export type TypographyKey = keyof typeof typography;
