import {
  gray_200,
  gray_300,
  gray_600,
  gray_800,
  violet_500,
  white,
} from "../constants/Colors";

export const headerLight = {
  tabBarActiveTintColor: violet_500,
  tabBarInactiveTintColor: gray_600,
  headerStyle: {
    backgroundColor: gray_200,
  },
  headerShadowVisible: false,
  headerTintColor: gray_800,
  headerShown: false,
  tabBarStyle: {
    backgroundColor: gray_200,
  },
};

export const headerDark = {
  tabBarActiveTintColor: violet_500,
  tabBarInactiveTintColor: gray_300,
  headerStyle: {
    backgroundColor: gray_800,
  },
  headerShadowVisible: false,
  headerTintColor: white,
  headerShown: false,
  tabBarStyle: {
    backgroundColor: gray_800,
  },
};
