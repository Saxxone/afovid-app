import SpacerY from "@/app_directories/components/app/SpacerY";
import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { useI18n } from "@/app_directories/context/I18nProvider";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { Link, router } from "expo-router";
import { View } from "react-native";

// Stub screen: backend has no password-reset endpoint yet. We render a
// "contact support" message so the deep link is not broken instead of the
// previous copy-pasted login form that silently posted to /auth/login.
export default function ForgotPassword() {
  const { t } = useI18n();

  return (
    <View style={tailwindClasses("container")}>
      <SpacerY size="lg" />
      <Text style={tailwindClasses("text-3xl font-bold")}>
        {t("login.forgot_password")}
      </Text>

      <SpacerY size="xxs" />

      <Text>
        Password reset is not available in-app yet. Please contact support to
        recover your account.
      </Text>

      <SpacerY size="sm" />

      <AppButton
        theme="primary"
        onPress={() => router.replace(app_routes.auth.login)}
      >
        {t("signup.sign_in")}
      </AppButton>

      <SpacerY size="xxs" />

      <View style={tailwindClasses("flex-row justify-center w-full")}>
        <Link href={app_routes.auth.register}>
          <Text>{t("login.create_account")}</Text>
          <Text> {t("login.sign_up")}</Text>
        </Link>
      </View>
    </View>
  );
}
