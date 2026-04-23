import { Theme } from "@react-navigation/native";

/**
 * Matches `useFonts` names in `app/_layout.tsx` (Outfit TTFs).
 * Used by React Navigation theme on web, iOS, and Android.
 */
export const fonts = {
  regular: {
    fontFamily: "Outfit Regular",
    fontWeight: "400",
  },
  medium: {
    fontFamily: "Outfit Medium",
    fontWeight: "500",
  },
  bold: {
    fontFamily: "Outfit SemiBold",
    fontWeight: "600",
  },
  heavy: {
    fontFamily: "Outfit Bold",
    fontWeight: "700",
  },
} as const satisfies Theme["fonts"];
