import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { submitReportNeed } from "../services/disasterService";

const PARISHES = [
  { label: "Select your parish…", value: "" },
  { label: "Westmoreland", value: "westmoreland" },
  { label: "St. James", value: "st_james" },
  { label: "St. Elizabeth", value: "st_elizabeth" },
] as const;

export type HurricaneVictimFormData = {
  name: string;
  parish: string;
  needsDescription: string;
  imageUri: string | null;
};

const initialFormState: HurricaneVictimFormData = {
  name: "",
  parish: "",
  needsDescription: "",
  imageUri: null,
};

export function HurricaneVictimForm() {
  const [form, setForm] = useState<HurricaneVictimFormData>(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof HurricaneVictimFormData, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow photo access to attach documentation."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      update("imageUri", result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    if (!form.parish) {
      Alert.alert("Required", "Please select your parish.");
      return;
    }
    if (!form.needsDescription.trim()) {
      Alert.alert("Required", "Please describe your needs.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReportNeed({
        name: form.name.trim(),
        parish: form.parish,
        needsDescription: form.needsDescription.trim(),
      });
      const status = result.status ?? "received";
      Alert.alert(
        "Request submitted",
        `Thank you. Your request has been received. Status: ${status}.`
      );
      setForm(initialFormState);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Submission failed. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-rescue-surface"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-6 pb-8 max-w-md mx-auto w-full">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-rescue-primary text-2xl font-bold tracking-tight">
              Hurricane Relief Request
            </Text>
            <Text className="text-rescue-secondary text-base mt-2 opacity-90">
              Tell us how we can help. All fields are required.
            </Text>
          </View>

          {/* Name */}
          <View className="mb-6">
            <Text className="text-rescue-primary text-base font-bold mb-2">
              Name
            </Text>
            <TextInput
              value={form.name}
              onChangeText={(v) => update("name", v)}
              placeholder="Your full name"
              placeholderTextColor="#64748b"
              className="bg-white border-2 border-rescue-primary rounded-xl px-4 py-4 text-lg text-rescue-primary font-medium min-h-[56px]"
              accessibilityLabel="Name"
              accessibilityHint="Enter your full name"
            />
          </View>

          {/* Parish */}
          <View className="mb-6">
            <Text className="text-rescue-primary text-base font-bold mb-2">
              Parish
            </Text>
            <View className="bg-white border-2 border-rescue-primary rounded-xl overflow-hidden min-h-[56px]">
              <Picker
                selectedValue={form.parish}
                onValueChange={(v) => update("parish", v)}
                style={{
                  height: 56,
                  fontSize: 18,
                  color: "#0c4a6e",
                  fontWeight: "500",
                }}
                prompt="Select parish"
                accessibilityLabel="Parish"
                accessibilityHint="Select your parish"
              >
                {PARISHES.map((p) => (
                  <Picker.Item
                    key={p.value || "placeholder"}
                    label={p.label}
                    value={p.value}
                    color="#0c4a6e"
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Needs description */}
          <View className="mb-6">
            <Text className="text-rescue-primary text-base font-bold mb-2">
              Describe your needs (details help us respond faster)
            </Text>
            <TextInput
              value={form.needsDescription}
              onChangeText={(v) => update("needsDescription", v)}
              placeholder="e.g. shelter, food, water, medical, supplies, location details…"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              className="bg-white border-2 border-rescue-primary rounded-xl px-4 py-4 text-lg text-rescue-primary font-medium min-h-[140px]"
              style={{ minHeight: 140 }}
              accessibilityLabel="Needs description"
              accessibilityHint="Describe what you need in detail"
            />
          </View>

          {/* Image upload placeholder */}
          <View className="mb-8">
            <Text className="text-rescue-primary text-base font-bold mb-2">
              Photo (optional)
            </Text>
            <TouchableOpacity
              onPress={pickImage}
              activeOpacity={0.8}
              className="bg-white border-2 border-dashed border-rescue-secondary rounded-xl min-h-[140px] justify-center items-center py-6 px-4"
            >
              {form.imageUri ? (
                <Text className="text-rescue-secondary text-base font-semibold text-center">
                  Photo attached ✓
                </Text>
              ) : (
                <>
                  <Text className="text-rescue-secondary text-lg font-bold text-center">
                    Tap to upload image
                  </Text>
                  <Text className="text-rescue-secondary text-sm mt-1 opacity-80 text-center">
                    Document damage or needs (optional)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.9}
            className="bg-rescue-accent rounded-xl py-4 px-6 min-h-[56px] justify-center items-center shadow-lg disabled:opacity-70"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white text-xl font-bold">
                Submit request
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
