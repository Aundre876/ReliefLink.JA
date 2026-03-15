import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

const MESH_STATUS_OPTIONS = [
  "5km LoRa Mesh: Connected",
  "5km LoRa Mesh: Intermittent",
  "5km LoRa Mesh: Searching...",
  "5km LoRa Mesh: Reconnected",
];

const SurvivalMode = () => {
  const [statusIdx, setStatusIdx] = useState(0);

  // Cycle mesh status every 3 seconds (simulate status changes)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % MESH_STATUS_OPTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSOS = () => {
    // For demo: Flash button or show message. Implement real logic as needed.
    alert("SOS signal sent via LoRa Mesh!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ReliefLink.JA</Text>
      <Text style={styles.subtitle}>Survival Mode</Text>
      <View style={styles.statusContainer}>
        <Text style={styles.meshStatus}>{MESH_STATUS_OPTIONS[statusIdx]}</Text>
      </View>
      <TouchableOpacity
        style={styles.sosButton}
        activeOpacity={0.85}
        onPress={handleSOS}
        accessibilityLabel="Send SOS"
      >
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SurvivalMode;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Deep black
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    color: "#FFD600", // High-contrast yellow (JA Gold)
    fontSize: 38,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 2,
    textTransform: "uppercase",
    textShadowColor: "#333",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: "#FFD600",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 60,
    letterSpacing: 1,
    textShadowColor: "#222",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statusContainer: {
    marginBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: "#FFD600",
  },
  meshStatus: {
    color: "#FFD600",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "#111",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  sosButton: {
    marginTop: 60,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    backgroundColor: "#FFD600",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 10,
    borderColor: "#fff",
    elevation: 22,
    shadowColor: "#FFD600",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  sosText: {
    color: "#000",
    fontSize: 72,
    fontWeight: "bold",
    textShadowColor: "#FFD600",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 1,
    letterSpacing: 6,
  },
});
