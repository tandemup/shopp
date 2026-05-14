import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

/* -----------------------------
   Context Providers
------------------------------ */
import { StoresProvider } from "./context/StoresContext";
import { ListsProvider } from "./context/ListsContext";
import { PurchasesProvider } from "./context/PurchasesContext";
import { LocationProvider } from "./context/LocationContext";
import { ProductSuggestionsProvider } from "./context/ProductSuggestionsContext";
import { ProductLearningProvider } from "./context/ProductLearningContext";

/* -----------------------------
   Screens
------------------------------ */
import SplashScreen from "./screens/system/SplashScreen";
/* -----------------------------
   Navigation
------------------------------ */
import MainTabs from "./navigation/MainTabs";
/* -----------------------------
   Alert host
------------------------------ */
import WebAlertHost from "./components/ui/alert/WebAlertHost";

const RootStack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <StoresProvider>
        <ListsProvider>
          <PurchasesProvider>
            <LocationProvider>
              <ProductLearningProvider>
                <ProductSuggestionsProvider>
                  <NavigationContainer>
                    <StatusBar style="auto" />
                    <RootStack.Navigator screenOptions={{ headerShown: false }}>
                      <RootStack.Screen
                        name="Splash"
                        component={SplashScreen}
                      />
                      <RootStack.Screen name="Main" component={MainTabs} />
                    </RootStack.Navigator>
                    <WebAlertHost />
                  </NavigationContainer>
                </ProductSuggestionsProvider>
              </ProductLearningProvider>
            </LocationProvider>
          </PurchasesProvider>
        </ListsProvider>
      </StoresProvider>
    </SafeAreaProvider>
  );
}
