import {
  gray_100,
  gray_200,
  gray_300,
  gray_400,
  gray_500,
  gray_600,
  gray_700,
  gray_800,
  gray_900,
  rose_100,
  rose_500,
  rounded_lg,
  violet_400,
  violet_700,
  white,
} from "../../constants/Colors";

const borders = {
  "rounded-lg": { borderRadius: rounded_lg },
  "rounded-full": { borderRadius: 9999 },
  border: { borderWidth: 1, borderStyle: "solid" },
  "border-b": { borderBottomWidth: 1, borderBottomStyle: "solid" },
  "border-t": { borderTopWidth: 1, borderTopStyle: "solid" },
  "border-l": { borderLeftWidth: 1, borderLeftStyle: "solid" },
  "border-r": { borderRightWidth: 1, borderRightStyle: "solid" },
  "border-transparent": { borderColor: "transparent" },
  "border-ttransparent": { borderTopColor: "transparent" },
  "border-btransparent": { borderBottomColor: "transparent" },
  "border-ltransparent": { borderLeftColor: "transparent" },
  "border-rtransparent": { borderRightColor: "transparent" },

  "border-gray-100": { borderColor: gray_100 },
  "border-gray-200": { borderColor: gray_200 },
  "border-gray-300": { borderColor: gray_300 },
  "border-gray-400": { borderColor: gray_400 },
  "border-gray-500": { borderColor: gray_500 },
  "border-gray-600": { borderColor: gray_600 },
  "border-gray-700": { borderColor: gray_700 },
  "border-gray-800": { borderColor: gray_800 },
  "border-gray-900": { borderColor: gray_900 },
  "border-white": { borderColor: white },
  "border-violet-400": { borderColor: violet_400 },
  "border-violet-700": { borderColor: violet_700 },

  //rose border
  "border-rose-100": { borderColor: rose_100 },
  "border-rose-500": { borderColor: rose_500 },
};

export default borders;
