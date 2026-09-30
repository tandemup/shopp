import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthHomeScreen from "@/src/screens/auth/AuthHomeScreen";
import WelcomeSurveyScreen from "@/src/screens/auth/WelcomeSurveyScreen";
import LoginScreen from "@/src/screens/auth/LoginScreen";
import RegisterScreen from "@/src/screens/auth/RegisterScreen";
import ResetPasswordScreen from "@/src/screens/auth/ResetPasswordScreen";

const Stack = createNativeStackNavigator();

const ACCESS_MODE = String(
  process.env.EXPO_PUBLIC_ACCESS_MODE || "landing",
)
  .trim()
  .toLowerCase();

function getInitialAuthRoute() {
  switch (ACCESS_MODE) {
    case "survey":
      return "WelcomeSurvey";

    case "login":
      return "Login";

    case "landing":
    default:
      return "AuthHome";
  }
}

export default function AuthStack() {
  useI18n();

  return (
    <Stack.Navigator
      initialRouteName={getInitialAuthRoute()}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AuthHome" component={AuthHomeScreen} />
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
