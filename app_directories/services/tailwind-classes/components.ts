import { gray_800, indigo_500, rounded_lg } from "../../constants/Colors";

const components = {
  /** Default screen gutter for list/scroll roots (align with home feed). */
  container: {
    width: "100%",
    maxWidth: "100vw",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 100,
    backgroundColor: gray_800,
  },
  button: {
    cursor: "pointer",
    borderRadius: rounded_lg,
  },

  "button:disabled": {
    cursor: "not-allowed",
    opacity: 0.5,
    pointerEvents: "none",
  },

  "btn-primary": {
    backgroundColor: indigo_500,
    color: "white",
    borderRadius: rounded_lg,
    fontWeight: "600",
    fontFamily: "Outfit SemiBold",
  },

  "btn-primary-outline": {
    borderWidth: 1,
    borderColor: indigo_500,
    color: indigo_500,
    padding: 16,
    borderRadius: rounded_lg,
    fontWeight: "600",
    fontFamily: "Outfit SemiBold",
  },
  "btn-md": {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  "btn-lg": {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  "btn-sm": {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  "btn-xs": {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
};

export default components;
