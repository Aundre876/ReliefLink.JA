/**
 * Criss AI - 24-Hour Emergency Response Assistant
 * ReliefLink.JA dispatcher (text/voice triage, no photo)
 */

import { getNearestHub, LOGISTICS_HUBS } from './routing';

/** System prompt: 24/7 ReliefLink Dispatcher - collect 3 pieces of info quickly */
export const CRISS_SYSTEM_PROMPT =
  'You are the 24/7 ReliefLink Dispatcher. Your primary job is to collect 3 pieces of info as quickly as possible: 1) Nature of the emergency, 2) Number of people affected, and 3) Current hazards (fire, water, structural collapse, etc.). Use Voice Activation if the user cannot type. When the user is vague, ask specific Yes/No questions to speed up triage. Be concise and professional.';

export interface DispatchInfo {
  hubName: string;
  hubParish?: string;
  etaMinutes: number;
  distanceKm: number;
  incidentSummary: string;
}

export interface CrissMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  dispatchSuggestion?: DispatchInfo;
}

function isVague(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 4) return true;
  if (/^(yes|no|ok|okay|maybe|i don't know)$/i.test(t)) return true;
  if (/^(help|emergency|sos)$/i.test(t)) return true;
  return false;
}

function getTriageReply(
  userMessage: string,
  lastLocation?: { lat: number; lng: number }
): { reply: string; dispatch?: DispatchInfo } {
  const lower = userMessage.trim().toLowerCase();

  if (lower.includes('thank') || lower.includes('thanks')) {
    return { reply: "You're welcome. Stay safe. If you need anything else, I'm here 24/7." };
  }

  if (isVague(userMessage)) {
    return {
      reply: 'I need a bit more detail. Is anyone injured? (Yes/No)',
    };
  }

  const hasPeople = /\d+\s*(people?|person|adults?|children?)?/i.test(userMessage) || /(one|two|three|few|several|many)\s+(people?|person)/i.test(userMessage);
  const hasHazard = /(fire|water|flood|structural|collapse|landslide|blocked|medical|food|rescue)/i.test(userMessage);
  const hasNature = /(flood|flooding|fire|collapse|landslide|medical|food|water|rescue|trapped|stuck)/i.test(userMessage);

  if (hasNature && (hasPeople || hasHazard)) {
    const loc: [number, number] = lastLocation
      ? [lastLocation.lat, lastLocation.lng]
      : [18.1, -77.3];
    const nearest = getNearestHub(loc, LOGISTICS_HUBS);
    if (nearest) {
      const etaMinutes = Math.round(nearest.distanceKm * 2.5);
      return {
        reply: `Request logged. Nearest hub: **${nearest.hub.name}** (${nearest.hub.parish ?? 'Parish coordinator'}). ETA: ~${etaMinutes} min. Your request has been sent to the parish coordinator. Stay safe.`,
        dispatch: {
          hubName: nearest.hub.name,
          hubParish: nearest.hub.parish,
          etaMinutes,
          distanceKm: nearest.distanceKm,
          incidentSummary: userMessage.slice(0, 200),
        },
      };
    }
  }

  if (hasNature && !hasPeople) {
    return { reply: 'How many people are affected? (Give a number)' };
  }
  if (hasPeople && !hasHazard) {
    return { reply: 'What is the main hazard? Fire, water/flooding, structural damage, or other?' };
  }

  return {
    reply: 'Describe the emergency in a few words: what happened, how many people, and any immediate hazards (fire, water, etc.).',
  };
}

/** Chat response - optimized for < 2 second reply */
export async function getCrissChatResponse(
  userMessage: string,
  context?: { lastLocation?: { lat: number; lng: number } },
  _systemPrompt: string = CRISS_SYSTEM_PROMPT
): Promise<{ reply: string; dispatch?: DispatchInfo }> {
  await new Promise((r) => setTimeout(r, 300));
  return getTriageReply(userMessage, context?.lastLocation);
}
