import "./global.css";
import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity, Text } from "react-native";
import OfflineMode from "./screens/OfflineMode";
import AuthScreen from "./screens/authScreen";
import CreateShipmentScreen from "./screens/createShipment";
import { Dashboard } from "./screens/Dashboard";
import type { DashboardRole } from "./screens/Dashboard";

export default function App() {
  const [userRole, setUserRole] = useState<DashboardRole | null>(null);
  const [activeScreen, setActiveScreen] = useState<"offline" | "auth" | "createShipment">("offline");

  if (activeScreen === "offline") {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
        <StatusBar style="light" />
        <OfflineMode />
        <TouchableOpacity
          onPress={() => setActiveScreen("auth")}
          className="absolute top-12 right-4 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500"
        >
          <Text className="text-amber-400 text-sm font-semibold">Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (activeScreen === "createShipment") {
    return (
      <SafeAreaView className="flex-1 bg-rescue-surface" edges={["top"]}>
        <StatusBar style="dark" />
        <CreateShipmentScreen onBack={() => setActiveScreen("auth")} />
      </SafeAreaView>
    );
  }

  if (userRole) {
    return (
      <SafeAreaView className="flex-1 bg-rescue-surface" edges={["top"]}>
        <StatusBar style="dark" />
        <Dashboard role={userRole} onLogout={() => setUserRole(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-rescue-surface" edges={["top"]}>
      <StatusBar style="dark" />
      <AuthScreen
        onLoginSuccess={(role) => setUserRole(role)}
        onGoToCreateShipment={() => setActiveScreen("createShipment")}
      />
    </SafeAreaView>
  );
}
