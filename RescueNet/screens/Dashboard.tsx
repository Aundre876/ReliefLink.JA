import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";

export type DashboardRole = "customer" | "driver" | "admin";

interface DashboardProps {
  role: DashboardRole;
  onLogout?: () => void;
}

function FeatureCard({
  title,
  onPress,
}: {
  title: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-white border-2 border-rescue-primary rounded-xl p-5 mb-4 min-h-[72px] justify-center"
    >
      <Text className="text-rescue-primary text-lg font-bold">{title}</Text>
    </TouchableOpacity>
  );
}

export function Dashboard({ role, onLogout }: DashboardProps) {
  return (
    <ScrollView
      className="flex-1 bg-rescue-surface"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-rescue-primary text-2xl font-bold tracking-tight">
            Dashboard
          </Text>
          <Text className="text-rescue-secondary text-base mt-1 opacity-90 capitalize">
            {role}
          </Text>
        </View>
        {onLogout && (
          <TouchableOpacity
            onPress={onLogout}
            className="bg-rescue-primary px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-semibold">Log out</Text>
          </TouchableOpacity>
        )}
      </View>

      {role === "customer" && (
        <>
          <FeatureCard
            title="New Shipping Request"
            onPress={() => {}}
          />
          <FeatureCard
            title="Track Delivery"
            onPress={() => {}}
          />
        </>
      )}

      {role === "driver" && (
        <>
          <FeatureCard
            title="Available Loads"
            onPress={() => {}}
          />
          <FeatureCard
            title="Active Routes"
            onPress={() => {}}
          />
        </>
      )}

      {role === "admin" && (
        <>
          <FeatureCard
            title="Resource Overview"
            onPress={() => {}}
          />
          <FeatureCard
            title="Emergency Mode Toggle"
            onPress={() => {}}
          />
        </>
      )}
    </ScrollView>
  );
}
