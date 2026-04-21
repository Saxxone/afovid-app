import SpacerY from "@/app_directories/components/app/SpacerY";
import Text from "@/app_directories/components/app/Text";
import AppButton from "@/app_directories/components/form/Button";
import FormInput from "@/app_directories/components/form/FormInput";
import api_routes from "@/app_directories/constants/ApiRoutes";
import { app_routes } from "@/app_directories/constants/AppRoutes";
import { primary } from "@/app_directories/constants/Colors";
import { useSession } from "@/app_directories/context/AppContext";
import { useI18n } from "@/app_directories/context/I18nProvider";
import { useSnackBar } from "@/app_directories/context/SnackBarProvider";
import { ValidationRule } from "@/app_directories/hooks/useValidation";
import {
  ApiConnectService,
  savePassword,
  saveTokens,
} from "@/app_directories/services/ApiConnectService";
import { registerPushAfterAuth } from "@/app_directories/services/pushRegistration";
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { FetchMethod } from "@/app_directories/types/types";
import { User } from "@/app_directories/types/user";
import GoogleAuthButton from "@/app_directories/components/auth/GoogleAuthButton";
import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Login() {
  const { t } = useI18n();
  const { snackBar, setSnackBar } = useSnackBar();
  const { signIn } = useSession();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toggled, setToggled] = useState(true);
  const [inputErrors, setInputErrors] = useState<Record<string, string> | null>(
    null,
  );

  const handleValidationError = (errors: Record<string, string> | null) => {
    setInputErrors(errors);
  };

  const validateLogin = () => {
    if (!usernameOrEmail || !password) {
      setInputErrors({ login: t("login.required_fields") });
      return false;
    }
    setInputErrors(null);
    return true;
  };

  const { isFetching, error, refetch } = useQuery({
    queryKey: ["login", usernameOrEmail, password],
    queryFn: async () => {
      const data = {
        usernameOrEmail: usernameOrEmail.trim(),
        password: password.trim(),
      };

      if (validateLogin()) {
        const res = await ApiConnectService<User>({
          url: api_routes.login,
          method: FetchMethod.POST,
          body: data,
        });
        return res;
      } else {
        return undefined;
      }
    },
    enabled: false,
    retry: false,
  });

  async function handleSignIn() {
    if (isFetching) return;

    if (validateLogin()) {
      const response = await refetch();

      if (error) {
        setSnackBar({
          ...snackBar,
          visible: true,
          title: t("common.error"),
          type: "error",
          message: error.message || t("login.login_failed"),
        });
      } else if (response.data && !response.data.error) {
        savePassword({
          username: usernameOrEmail.trim(),
          password: password,
        });
        saveTokens({
          access_token: response?.data?.data?.access_token as string,
          refresh_token: response?.data?.data?.refresh_token as string,
        });
        signIn();
        void registerPushAfterAuth();
        router.replace(app_routes.post.home);
      }
    }
  }

  function togglePasswordField() {
    setToggled(!toggled);
  }

  const validationRules: Record<string, ValidationRule[]> = useMemo(
    () => ({
      password: [
        { type: "required", message: t("login.validation_password_required") },
        {
          type: "min",
          value: 4,
          message: t("login.validation_password_min"),
        },
      ],
      username: [
        { type: "required", message: t("login.validation_username_required") },
      ],
    }),
    [t],
  );

  return (
    <View style={tailwindClasses("container")}>
      <SpacerY size="lg" />
      <Text style={tailwindClasses("text-3xl font-bold")}>
        {t("login.welcome")}
      </Text>

      <SpacerY size="xxs" />

      <FormInput
        placeholder={t("login.email_username")}
        value={usernameOrEmail}
        validationRules={validationRules.username}
        autoComplete="username"
        keyboardType="default"
        inputMode="text"
        onChangeText={setUsernameOrEmail}
        prependIcon="person-outline"
        editable={!isFetching}
        onValidationError={handleValidationError}
      />
      <FormInput
        placeholder={t("login.password")}
        validationRules={validationRules.password}
        value={password}
        autoComplete="password"
        inputMode="text"
        onChangeText={setPassword}
        secureTextEntry={toggled}
        prependIcon="lock-closed-outline"
        onAppendPressed={togglePasswordField}
        appendIcon={toggled ? "eye-outline" : "eye-off-outline"}
        editable={!isFetching}
        onValidationError={handleValidationError}
      />

      <View style={tailwindClasses("justify-end flex-row w-full")}>
        <Link href={app_routes.auth.forgot_password}>
          <Text style={tailwindClasses("self-end")}>
            {t("login.forgot_password")}
          </Text>
        </Link>
      </View>

      <SpacerY size="xxs" />

      <AppButton onPress={handleSignIn} theme="primary">
        {isFetching ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          t("login.login")
        )}
      </AppButton>

      <View>
        {inputErrors
          ? Object.values(inputErrors).map((error, index) => (
              <Text key={`${index}-error-message`}>{error}</Text>
            ))
          : null}
      </View>

      <SpacerY size="xxs" />

      <View style={tailwindClasses("flex-row justify-center w-full")}>
        <Link href={app_routes.auth.register}>
          <Text>{t("login.create_account")}</Text>
          <Text style={{ color: primary }}> {t("login.sign_up")}</Text>
        </Link>
      </View>

      <GoogleAuthButton mode="signin" />
    </View>
  );
}
