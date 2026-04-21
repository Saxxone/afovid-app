import {
  gray_200,
  gray_300,
  gray_600,
  gray_700,
} from "@/app_directories/constants/Colors";
import { useEffect, useMemo, useRef } from "react";
import { Animated, useColorScheme } from "react-native";
import tailwindClasses from "@/app_directories/services/ClassTransformer";

interface Props {
  width: string;
  height: string;
  radius: string;
  readonly className?: string;
}

const SkeletonLoader = ({ width, height, radius, className }: Props) => {
  const scheme = useColorScheme() ?? "light";
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animatedValue]);

  const { from, to } = useMemo(
    () =>
      scheme === "dark"
        ? { from: gray_700, to: gray_600 }
        : { from: gray_200, to: gray_300 },
    [scheme],
  );

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [from, to],
  });

  return (
    <Animated.View
      style={[
        tailwindClasses(`${width} ${height} ${radius} ${className}`),
        { backgroundColor },
      ]}
    />
  );
};

export default SkeletonLoader;
