import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthHomeScreen from "@/src/screens/auth/AuthHomeScreen";
import WelcomeSurveyScreen from "@/src/screens/auth/WelcomeSurveyScreen";
import LoginScreen from "@/src/screens/auth/LoginScreen";
import RegisterScreen from "@/src/screens/auth/RegisterScreen";
import ResetPasswordScreen from "@/src/screens/auth/ResetPasswordScreen";
import DevelopmentScreen from "@/src/screens/system/DevelopmentScreen";
import InformationScreen from "@/src/screens/system/InformationScreen";

const Stack = createNativeStackNavigator();

function normalizeAccessMode(value) {
  const mode = String(value || "landing").trim().toLowerCase();

  if (["landing", "survey", "login", "auto", "development"].includes(mode)) {
    return mode;
  }

  return "landing";
}

function getInitialAuthRoute(accessMode) {
  switch (normalizeAccessMode(accessMode)) {
    case "survey":
      return "WelcomeSurvey";

    case "login":
      return "Login";

    case "development":
      return "Development";

    case "auto":
    case "landing":
    default:
      return "AuthHome";
  }
}

export default function AuthStack({
  accessMode = process.env.EXPO_PUBLIC_ACCESS_MODE || "landing",
  isAuthenticated = false,
  onAuthenticatedContinue,
  onGuestContinue,
}) {
  useI18n();

  return (
    <Stack.Navigator
      initialRouteName={getInitialAuthRoute(accessMode)}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Development" component={DevelopmentScreen} />
      <Stack.Screen name="Information" component={InformationScreen} />
      <Stack.Screen name="AuthHome">
        {(props) => (
          <AuthHomeScreen
            {...props}
            isAuthenticated={isAuthenticated}
            onAuthenticatedContinue={onAuthenticatedContinue}
            onGuestContinue={onGuestContinue}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="WelcomeSurvey" component={WelcomeSurveyScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          title: tr("Restablecer contraseña"),
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
