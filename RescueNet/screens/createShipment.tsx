import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { handleCreateShipment } from "../services/rescueLogic";

const isWeb = Platform.OS === "web";

const PACKAGE_TYPES = [
  { label: "Food", value: "food" },
  { label: "Medicine", value: "medicine" },
  { label: "Electronics", value: "electronics" },
  { label: "Other...", value: "other" },
];

const PACKAGE_SIZES = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
];

const PRIORITY_COLORS = {
  low: "bg-green-200 border-green-500",
  medium: "bg-orange-200 border-orange-500",
  high: "bg-red-200 border-red-500",
};

const PRIORITIES = [
  { label: "Low", value: "low", color: "text-green-700" },
  { label: "Medium", value: "medium", color: "text-orange-700" },
  { label: "High", value: "high", color: "text-red-700" },
];

interface CreateShipmentScreenProps {
  onBack?: () => void;
}

export default function CreateShipmentScreen({ onBack }: CreateShipmentScreenProps) {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [packageType, setPackageType] = useState(PACKAGE_TYPES[0].value);
  const [packageSize, setPackageSize] = useState(PACKAGE_SIZES[0].value);
  const [priority, setPriority] = useState(PRIORITIES[0].value);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const showDeadlinePicker = () => setShowDatePicker(true);
  const hideDeadlinePicker = () => setShowDatePicker(false);

  const onChangeDeadline = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android" && event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    const date = selectedDate || deadline || new Date();
    setDeadline(date);
    setShowDatePicker(false);
  };

  const onWebDateChange = (e: { target: { value: string } }) => {
    const val = e.target.value;
    setDeadline(val ? new Date(val) : null);
  };

  const [submitting, setSubmitting] = useState(false);
  const otherTypeInputRef = useRef<any>(null);

  const onSubmit = async () => {
    if (!pickup.trim()) {
      Alert.alert("Required", "Please enter a pickup location.");
      return;
    }
    if (!destination.trim()) {
      Alert.alert("Required", "Please enter a destination.");
      return;
    }
    setSubmitting(true);
    try {
      await handleCreateShipment({
        pickup: pickup.trim(),
        destination: destination.trim(),
        packageType,
        packageSize,
        priority,
        deadline,
      });
      if (priority === "high") {
        Alert.alert("Priority Logistics Activated");
      } else {
        Alert.alert("Success", "Shipment created successfully.");
      }
      setPickup("");
      setDestination("");
      setPackageType(PACKAGE_TYPES[0].value);
      setPackageSize(PACKAGE_SIZES[0].value);
      setPriority(PRIORITIES[0].value);
      setDeadline(null);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to create shipment.";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-5 py-7">
      <View className="flex-row items-center justify-between mb-5">
        {onBack && (
          <TouchableOpacity onPress={onBack} className="py-2 pr-4">
            <Text className="text-rescue-primary font-semibold">← Back to Login</Text>
          </TouchableOpacity>
        )}
        <Text className="text-2xl font-bold text-rescue-primary flex-1">
          Create Shipment
        </Text>
      </View>

      {/* Pickup Location Input */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-1">
          Pickup Location
        </Text>
        <TextInput
          value={pickup}
          onChangeText={setPickup}
          placeholder="Enter pickup address or hub"
          className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-800"
          placeholderTextColor="#a1a1aa"
        />
      </View>

      {/* Destination Input */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-1">
          Destination
        </Text>
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Enter delivery address"
          className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-800"
          placeholderTextColor="#a1a1aa"
        />
      </View>

      {/* Package Type - button group (web + native compatible) */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Package Type
        </Text>
        <View className="flex-row flex-wrap gap-x-3 gap-y-2">
          {PACKAGE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => {
                setPackageType(type.value);
                if (type.value === "other") {
                  setTimeout(() => otherTypeInputRef.current?.focus(), 50);
                }
              }}
              activeOpacity={0.8}
              className={`flex-1 min-w-[80px] items-center py-3 rounded-lg border-2 ${
                (packageType === type.value) ||
                (type.value === "other" && !PACKAGE_TYPES.slice(0, -1).some((t) => t.value === packageType))
                  ? "border-rescue-primary bg-rescue-primary/10"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Text
                className={
                  (packageType === type.value) ||
                  (type.value === "other" && !PACKAGE_TYPES.slice(0, -1).some((t) => t.value === packageType))
                    ? "text-rescue-primary font-bold"
                    : "text-gray-700"
                }
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {(packageType === "other" || !PACKAGE_TYPES.slice(0, -1).some((t) => t.value === packageType)) && (
          <TextInput
            ref={otherTypeInputRef}
            value={packageType === "other" ? "" : packageType}
            onChangeText={(text) => setPackageType(text || "other")}
            placeholder="Other (please specify exactly what you need here)..."
            placeholderTextColor="#9ca3af"
            className="mt-2 border border-gray-200 rounded-lg px-4 py-3 bg-gray-100 text-gray-800"
            style={{ opacity: 1 }}
          />
        )}
      </View>

      {/* Package Size Toggle */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Package Size
        </Text>
        <View className="flex-row gap-x-3">
          {PACKAGE_SIZES.map((size) => (
            <TouchableOpacity
              key={size.value}
              onPress={() => setPackageSize(size.value)}
              activeOpacity={0.8}
              className={`flex-1 items-center py-3 rounded-lg border-2 ${
                packageSize === size.value
                  ? "border-rescue-primary bg-rescue-primary/10"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Text
                className={
                  packageSize === size.value
                    ? "text-rescue-primary font-bold"
                    : "text-gray-700"
                }
              >
                {size.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Priority Selector */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Priority
        </Text>
        <View className="flex-row gap-x-3">
          {PRIORITIES.map((item) => (
            <TouchableOpacity
              key={item.value}
              onPress={() => setPriority(item.value)}
              activeOpacity={0.8}
              className={`flex-1 items-center py-3 rounded-lg border-2 ${
                priority === item.value
                  ? PRIORITY_COLORS[item.value as keyof typeof PRIORITY_COLORS]
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <Text
                className={`font-bold ${
                  priority === item.value ? item.color : "text-gray-700"
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Delivery Deadline - HTML5 input on web, DateTimePicker on native */}
      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          Delivery Deadline
        </Text>
        {isWeb ? (
          React.createElement("input", {
            type: "date",
            value: deadline ? deadline.toISOString().split("T")[0] : "",
            onChange: onWebDateChange,
            min: new Date().toISOString().split("T")[0],
            style: {
              width: "100%",
              padding: 12,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              backgroundColor: "#f9fafb",
              color: "#1e293b",
              fontSize: 16,
            },
          })
        ) : (
          <>
            <TouchableOpacity
              onPress={showDeadlinePicker}
              activeOpacity={0.8}
              className="flex-row px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 items-center"
            >
              <Text
                className={
                  deadline
                    ? "text-slate-800"
                    : "text-gray-400"
                }
              >
                {deadline
                  ? deadline.toLocaleDateString()
                  : "Select delivery deadline"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (() => {
              const DateTimePicker = require("@react-native-community/datetimepicker").default;
              return (
                <DateTimePicker
                  value={deadline || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={onChangeDeadline}
                  minimumDate={new Date()}
                />
              );
            })()}
          </>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        className="bg-rescue-primary rounded-lg py-4"
        activeOpacity={0.85}
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-center text-white font-bold text-lg">
            Create Shipment
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}