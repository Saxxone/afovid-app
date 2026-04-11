import { StyleSheet } from "react-native";
import tailwind_to_RN_map from "./tailwind";

/**
 * Transforms Tailwind CSS class names into a React Native stylesheet object.
 * Pass one space-separated string and/or multiple arguments — each token is resolved against the map.
 *
 * @example tailwindClasses("container flex-1")
 * @example tailwindClasses("container", "flex-1")
 */

export type ClassKeys = keyof typeof tailwind_to_RN_map;

const tailwindClasses = (
  ...class_names: (ClassKeys | string)[]
): StyleSheet.NamedStyles<object> => {
  let styles = {};
  const tokens = class_names.flatMap((c) =>
    String(c).trim().split(/\s+/).filter(Boolean),
  );

  tokens.forEach((cls) => {
    if (cls in tailwind_to_RN_map) {
      const key = cls as ClassKeys;
      styles = { ...styles, ...tailwind_to_RN_map[key] };
    }
  });

  return StyleSheet.create(styles);
};

export default tailwindClasses;
