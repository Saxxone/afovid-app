import GoogleAuthButton from "@/app_directories/components/auth/GoogleAuthButton";
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
import tailwindClasses from "@/app_directories/services/ClassTransformer";
import { registerPushAfterAuth } from "@/app_directories/services/pushRegistration";
import { FetchMethod } from "@/app_directories/types/types";
import { User } from "@/app_directories/types/user";
import { authDebug, authWarn } from "@/app_directories/utils/authDebugLog";
import { useMutation } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

interface RegisterInputs {
  name: string;
  username: string;
  email: string;
  password: string;
}

export default function Register() {
  const { t } = useI18n();
  const { snackBar, setSnackBar } = useSnackBar();
  const { signIn } = useSession();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toggled, setToggled] = useState(true);
  const [inputErrors, setInputErrors] = useState<Record<string, string> | null>(
    null,
  );

  const handleValidationError = (errors: Record<string, string> | null) => {
    setInputErrors(errors);
  };

  function validateRegister(values: RegisterInputs) {
    const errors: Record<string, string> = {};
    if (!values.name) errors.name = t("signup.full_name");
    if (!values.username) errors.username = t("signup.username");
    if (!values.email) errors.email = t("signup.email");
    if (!values.password || values.password.length < 8) {
      errors.password = t("login.validation_password_min");
    }
    if (Object.keys(errors).length > 0) {
      setInputErrors(errors);
      return false;
    }
    setInputErrors(null);
    return true;
  }

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterInputs) => {
      // Step 1: create the account.
      const createRes = await ApiConnectService<User>({
        url: api_routes.register,
        method: FetchMethod.POST,
        body: {
          name: values.name.trim(),
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
        },
      });
      if (createRes.error || !createRes.data) {
        const msg =
          (createRes.error as { message?: string })?.message ||
          t("login.login_failed");
        throw new Error(msg);
      }

      // Step 2: log in immediately to get JWT pair (register endpoint does not return tokens).
      const loginRes = await ApiConnectService<User>({
        url: api_routes.login,
        method: FetchMethod.POST,
        body: {
          usernameOrEmail: values.email.trim(),
          password: values.password,
        },
      });
      if (loginRes.error || !loginRes.data?.access_token) {
        const msg =
          (loginRes.error as { message?: string })?.message ||
          t("login.login_failed");
        throw new Error(msg);
      }
      return loginRes.data;
    },
    onSuccess: async (user) => {
      try {
        await savePassword({
          username: email.trim(),
          password,
        });
        await saveTokens({
          access_token: user.access_token ?? null,
          refresh_token: user.refresh_token ?? null,
        });
      } catch (e) {
        authWarn("register:keychain_persist_failed", {
          message: e instanceof Error ? e.message : String(e),
        });
        setSnackBar({
          ...snackBar,
          visible: true,
          title: t("common.error"),
          type: "error",
          message: t("login.login_failed"),
        });
        return;
      }
      authDebug("register:navigating_home");
      signIn();
      void registerPushAfterAuth();
      router.replace(app_routes.post.home);
    },
    onError: (err) => {
      authWarn("register:failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      setSnackBar({
        ...snackBar,
        visible: true,
        title: t("common.error"),
        type: "error",
        message:
          (err instanceof Error ? err.message : null) ||
          t("login.login_failed"),
      });
    },
  });

  async function handleRegister() {
    if (registerMutation.isPending) return;
    const values: RegisterInputs = { name, username, email, password };
    if (!validateRegister(values)) return;
    authDebug("register:submit", { emailLen: email.trim().length });
    await registerMutation.mutateAsync(values).catch(() => undefined);
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
          value: 8,
          message: t("login.validation_password_min"),
        },
      ],
      username: [
        { type: "required", message: t("login.validation_username_required") },
      ],
      name: [{ type: "required", message: t("signup.full_name") }],
      email: [{ type: "required", message: t("signup.email") }],
    }),
    [t],
  );

  const isPending = registerMutation.isPending;

  return (
    <View style={tailwindClasses("container")}>
      <SpacerY size="lg" />
      <Text style={tailwindClasses("text-3xl font-bold")}>
        {t("signup.welcome")}
      </Text>

      <SpacerY size="xxs" />

      <FormInput
        placeholder={t("signup.full_name")}
        value={name}
        validationRules={validationRules.name}
        keyboardType="default"
        inputMode="text"
        onChangeText={setName}
        prependIcon="person-outline"
        editable={!isPending}
        onValidationError={handleValidationError}
      />
      <FormInput
        placeholder={t("signup.username")}
        value={username}
        validationRules={validationRules.username}
        autoComplete="username"
        keyboardType="default"
        inputMode="text"
        onChangeText={setUsername}
        prependIcon="person-outline"
        editable={!isPending}
        onValidationError={handleValidationError}
      />
      <FormInput
        placeholder={t("signup.email")}
        value={email}
        validationRules={validationRules.email}
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        onChangeText={setEmail}
        prependIcon="person-outline"
        editable={!isPending}
        onValidationError={handleValidationError}
      />
      <FormInput
        placeholder={t("signup.password")}
        validationRules={validationRules.password}
        value={password}
        autoComplete="password"
        inputMode="text"
        onChangeText={setPassword}
        secureTextEntry={toggled}
        prependIcon="lock-closed-outline"
        onAppendPressed={togglePasswordField}
        appendIcon={toggled ? "eye-outline" : "eye-off-outline"}
        editable={!isPending}
        onValidationError={handleValidationError}
      />

      <SpacerY size="xxs" />

      <AppButton onPress={handleRegister} theme="primary">
        {isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          t("signup.sign_up")
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
        <Link href={app_routes.auth.login}>
          <Text>{t("signup.already_account")}</Text>
          <Text style={{ color: primary }}> {t("signup.sign_in")}</Text>
        </Link>
      </View>

      <GoogleAuthButton mode="signup" />
    </View>
  );
}
