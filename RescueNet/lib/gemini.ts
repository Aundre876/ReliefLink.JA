import { GoogleGenAI } from "@google/genai";
import * as FileSystem from "expo-file-system";
import type { GeminiReliefResponse } from "./gemini-types";

/** Form payload sent to Gemini (text + optional image). */
export type ReliefFormPayload = {
  name: string;
  parish: string;
  needsDescription: string;
  /** Optional local file URI (e.g. from expo-image-picker). */
  imageUri: string | null;
};

const RELIEF_RESPONSE_SCHEMA = `
Return ONLY a single valid JSON object (no markdown, no code fence, no extra text) with exactly these fields:
- urgency_score: number from 1 (low) to 10 (critical)
- category: one of "Medical" | "Food" | "Water" | "Shelter"
- extracted_items: array of { "name": string, "quantity": string } for each item and quantity mentioned (e.g. water bottles, blankets, meals). Use empty array [] if none.
`;

/**
 * Reads a local image URI and returns its base64 string and mime type.
 * Supports file:// and content:// URIs.
 */
async function imageUriToBase64(
  uri: string
): Promise<{ data: string; mimeType: string }> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  const lower = uri.toLowerCase();
  const mimeType = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return { data: base64, mimeType };
}

/**
 * Sends the hurricane relief form text and optional image to the Gemini API,
 * and returns a structured JSON object: urgency_score, category, extracted_items.
 *
 * @param payload - Form data (name, parish, needsDescription, imageUri)
 * @param apiKey - Gemini API key (use EXPO_PUBLIC_GEMINI_API_KEY in app)
 * @returns Parsed GeminiReliefResponse
 * @throws Error if API key is missing, request fails, or response is not valid JSON
 */
export async function sendReliefFormToGemini(
  payload: ReliefFormPayload,
  apiKey: string
): Promise<GeminiReliefResponse> {
  if (!apiKey?.trim()) {
    throw new Error("Gemini API key is required.");
  }

  const textPrompt = [
    "You are analyzing a hurricane relief request. Use the following details to assess urgency, category, and extract requested items.",
    "",
    "Name: " + payload.name,
    "Parish: " + payload.parish,
    "Description of needs:",
    payload.needsDescription,
    "",
    payload.imageUri
      ? "An image was also attached (e.g. damage or supplies). Use it to inform urgency and extracted_items if relevant."
      : "",
    RELIEF_RESPONSE_SCHEMA,
  ]
    .filter(Boolean)
    .join("\n");

  const contents: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (payload.imageUri) {
    try {
      const { data, mimeType } = await imageUriToBase64(payload.imageUri);
      contents.push({ inlineData: { mimeType, data } });
    } catch (e) {
      // If image read fails, continue with text only
      const err = e instanceof Error ? e : new Error(String(e));
      console.warn("Could not read image for Gemini:", err.message);
    }
  }

  contents.push({ text: textPrompt });

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents,
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("Gemini returned no text.");
  }

  // Strip optional markdown code fence if present
  let jsonStr = rawText;
  const fenceMatch = rawText.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Gemini response was not valid JSON: " + rawText.slice(0, 200));
  }

  const r = parsed as Record<string, unknown>;
  if (
    typeof r.urgency_score !== "number" ||
    !["Medical", "Food", "Water", "Shelter"].includes(r.category as string) ||
    !Array.isArray(r.extracted_items)
  ) {
    throw new Error(
      "Gemini response missing required fields: urgency_score (number), category (Medical|Food|Water|Shelter), extracted_items (array)."
    );
  }

  return {
    urgency_score: r.urgency_score,
    category: r.category as GeminiReliefResponse["category"],
    extracted_items: (r.extracted_items as GeminiReliefResponse["extracted_items"]).map(
      (item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          name: typeof i.name === "string" ? i.name : String(i.name ?? ""),
          quantity: typeof i.quantity === "string" ? i.quantity : String(i.quantity ?? ""),
        };
      }
    ),
  };
}
