import { messages_fab, white } from "@/app_directories/constants/Colors";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Ionicons } from "@expo/vector-icons";
import { Link, RelativePathString } from "expo-router";
import { memo } from "react";
import { Platform, View } from "react-native";

interface Props {
  readonly to: RelativePathString;
  readonly icon?: "pencil-outline" | "create-outline";
  /** Fill for the circular button (default: messages design purple). */
  readonly backgroundColor?: string;
  /** Distance from the bottom of the parent (content area above tab bar). */
  readonly bottom?: number;
  readonly right?: number;
}

const FloatingActionButton = memo(
  ({
    to,
    icon = "pencil-outline",
    backgroundColor = messages_fab,
    bottom = 20,
    right = 12,
  }: Props) => {
    return (
      <Link
        href={to}
        style={{
          position: "absolute",
          zIndex: 50,
          right,
          bottom,
          elevation: Platform.OS === "android" ? 6 : undefined,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <View
          style={[
            tailwindClasses(
              "justify-center flex items-center rounded-full w-14 h-14",
            ),
            { backgroundColor },
          ]}
        >
          <Ionicons name={icon} size={24} color={white} />
        </View>
      </Link>
    );
  },
);

export default FloatingActionButton;
