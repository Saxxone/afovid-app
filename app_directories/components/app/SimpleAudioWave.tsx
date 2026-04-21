import { memo } from "react";
import { View } from "react-native";
import tailwindClasses from "@/app_directories/services/ClassTransformer";

/** Lightweight placeholder bars for in-feed / chat audio affordance. */
const SimpleAudioWave = memo(function SimpleAudioWave({
  barCount = 12,
}: {
  readonly barCount?: number;
}) {
  const heights = [40, 65, 45, 80, 55, 90, 50, 70, 60, 85, 48, 72];
  return (
    <View style={tailwindClasses("flex-row items-end gap-0.5 h-10")}>
      {Array.from({ length: barCount }, (_, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: `${heights[i % heights.length]}%`,
            borderRadius: 2,
            backgroundColor: "#6366f1",
          }}
        />
      ))}
    </View>
  );
});

export default SimpleAudioWave;
