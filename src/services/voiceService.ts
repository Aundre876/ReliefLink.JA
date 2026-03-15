/**
 * Voice service - Speech-to-Text (Web Speech API) and Text-to-Speech
 * Works offline for recording; STT requires browser support
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Web Speech API - not in all TypeScript libs; use (window as any) for Chrome/Safari
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (e: SpeechRecognitionResultEvent) => void;
  onend: () => void;
  onerror: (e: Event & { error?: string }) => void;
}

/** Event type for onresult - export for use in CrissChat */
export interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultItem {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export function isSpeechRecognitionSupported(): boolean {
  return !!SpeechRecognitionAPI;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Our callback result type - distinct from Web Speech API's SpeechRecognitionResult */
export interface VoiceTranscriptResult {
  transcript: string;
  isFinal: boolean;
}

/** Start listening for speech; returns transcript via callback, stops when user pauses */
export function startListening(
  onResult: (result: VoiceTranscriptResult) => void,
  onEnd: () => void,
  onError?: (err: string) => void
): (() => void) | null {
  if (!SpeechRecognitionAPI) {
    onError?.('Speech recognition not supported in this browser.');
    return null;
  }

  const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-JM';

  let fullTranscript = '';

  recognition.onresult = (e: SpeechRecognitionResultEvent) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0].transcript;
      if (result.isFinal) {
        fullTranscript += text + ' ';
        onResult({ transcript: fullTranscript.trim(), isFinal: true });
      } else {
        interim += text;
        onResult({ transcript: (fullTranscript + interim).trim(), isFinal: false });
      }
    }
  };

  recognition.onend = () => onEnd();
  recognition.onerror = (e: Event & { error?: string }) => onError?.(e.error || 'Recognition error');

  try {
    recognition.start();
    return () => {
      try {
        recognition.stop();
      } catch {
        // Already stopped
      }
    };
  } catch (e) {
    onError?.('Could not start microphone.');
    return null;
  }
}

/** Speak text aloud with calm voice - for Criss replies */
export function speakText(text: string, onEnd?: () => void): (() => void) | null {
  if (!isSpeechSynthesisSupported()) return null;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.lang = 'en-JM';

  const setVoice = () => {
    const voices = speechSynthesis.getVoices();
    const calmVoice = voices.find((v) => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Google UK') || v.lang.startsWith('en'));
    if (calmVoice) utterance.voice = calmVoice;
  };
  setVoice();
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = setVoice;
  }

  if (onEnd) utterance.onend = onEnd;

  speechSynthesis.speak(utterance);
  return () => speechSynthesis.cancel();
}

/** Stop any ongoing speech */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}
