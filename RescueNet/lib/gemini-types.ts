/** Category for hurricane relief requests (from Gemini). */
export type ReliefCategory = "Medical" | "Food" | "Water" | "Shelter";

/** Single extracted item with quantity (from Gemini). */
export type ExtractedItem = {
  /** Item name (e.g. "water bottles", "blankets"). */
  name: string;
  /** Quantity (e.g. "10", "2 boxes"). */
  quantity: string;
};

/** Structured JSON response from Gemini for a relief request. */
export type GeminiReliefResponse = {
  /** Urgency from 1 (low) to 10 (critical). */
  urgency_score: number;
  /** Primary category. */
  category: ReliefCategory;
  /** List of items and quantities extracted from the request. */
  extracted_items: ExtractedItem[];
};
