import Text from "@/app_directories/components/app/Text";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { primary } from "@/app_directories/constants/Colors";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { ApiConnectService } from "@/app_directories/services/ApiConnectService";
import type { User } from "@/app_directories/types/user";
import { FetchMethod } from "@/app_directories/types/types";
import {
  tokenizePostRichText,
  type RichSegment,
} from "@/app_directories/utils/postRichText";
import { useRouter } from "expo-router";
import { memo, useCallback } from "react";
import { Linking } from "react-native";

type Props = {
  readonly text: string;
  readonly numberOfLines?: number;
  readonly className?: string;
};

const PostRichTextDisplay = memo(function PostRichTextDisplay({
  text,
  numberOfLines,
  className,
}: Props) {
  const router = useRouter();
  const segments = tokenizePostRichText(text);

  const openMention = useCallback(
    async (username: string) => {
      const res = await ApiConnectService<User[]>({
        url: api_routes.users.search(username),
        method: FetchMethod.GET,
      });
      const first = res.data?.[0];
      if (first?.id) {
        router.push(app_routes.profile.view(first.id));
      }
    },
    [router],
  );

  const renderSegment = (seg: RichSegment, i: number) => {
    if (seg.type === "text") {
      return (
        <Text key={i} className={className}>
          {seg.text}
        </Text>
      );
    }
    if (seg.type === "link") {
      return (
        <Text
          key={i}
          className={className}
          style={{ color: primary, textDecorationLine: "underline" }}
          onPress={() => void Linking.openURL(seg.href)}
        >
          {seg.text}
        </Text>
      );
    }
    return (
      <Text
        key={i}
        className={className}
        style={{ color: primary, fontWeight: "600" }}
        onPress={() => void openMention(seg.username)}
      >
        {seg.text}
      </Text>
    );
  };

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {segments.map((s, i) => renderSegment(s, i))}
    </Text>
  );
});

export default PostRichTextDisplay;
