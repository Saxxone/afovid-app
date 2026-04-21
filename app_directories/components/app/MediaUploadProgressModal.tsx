import Text from "@/app_directories/components/app/Text";
import { violet_500 } from "@/app_directories/constants/Colors";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Modal, Pressable, View } from "react-native";

type Props = {
  readonly visible: boolean;
  /** 0–100 */
  readonly progress: number;
  readonly onDismiss?: () => void;
};

export default function MediaUploadProgressModal({
  visible,
  progress,
  onDismiss,
}: Props) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={tailwindClasses(
          "flex-1 bg-black/50 items-center justify-center p-6",
        )}
      >
        <View
          style={tailwindClasses(
            "w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-5",
          )}
        >
          <Text className="text-lg font-semibold mb-2">Uploading</Text>
          <View
            style={tailwindClasses("h-2 w-full bg-gray-200 rounded-full mb-2")}
          >
            <View
              style={{
                height: 8,
                width: `${pct}%`,
                borderRadius: 999,
                backgroundColor: violet_500,
              }}
            />
          </View>
          <Text className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {pct.toFixed(0)}%
          </Text>
          {onDismiss ? (
            <Pressable onPress={onDismiss}>
              <Text className="text-indigo-600 text-center">Hide</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
