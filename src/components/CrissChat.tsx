import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  getCrissChatResponse,
  CRISS_SYSTEM_PROMPT,
  type CrissMessage,
  type DispatchInfo,
} from '../services/criss';
import {
  startListening,
  speakText,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  type SpeechRecognitionResultEvent,
} from '../services/voiceService';
import { saveVoiceSos, saveHelpRequest } from '../services/offlineDb';
import AudioWaveform from './AudioWaveform';

const NAVY = '#001F3F';
const SAFETY_RED = '#FF4136';

const WAKE_PHRASES = ['criss i need help', 'criss help', 'criss emergency', 'hey criss'];

interface CrissChatProps {
  userLocation?: [number, number] | null;
  onDispatchConfirm?: (dispatch: DispatchInfo) => void;
  darkMode?: boolean;
  isOffline?: boolean;
  /** Manual form context - visible to Criss when user switches to AI mode */
  initialContext?: string;
  /** When true, show chat inline (no floating button) - for modal/embedded use */
  embedded?: boolean;
  /** Guest ID for anonymous emergency users - included when saving voice SOS offline */
  guestId?: string | null;
}

export default function CrissChat({ userLocation, onDispatchConfirm, darkMode, isOffline, initialContext, embedded, guestId }: CrissChatProps) {
  const [open, setOpen] = useState(!!embedded);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceWaveActive, setVoiceWaveActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dispatchLogged, setDispatchLogged] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [messages, setMessages] = useState<CrissMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi, I'm Criss, your 24/7 ReliefLink dispatcher. Describe your emergency—or use the mic if you can't type. I need: 1) What happened, 2) How many people, 3) Any hazards (fire, water, etc.).",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
      mediaRecorderRef.current?.stop();
    };
  }, []);

  const handleSendFromVoiceRef = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    if (!handsFreeMode || !open || !isSpeechRecognitionSupported() || isOffline) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-JM';
    rec.onresult = (e: SpeechRecognitionResultEvent) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .toLowerCase();
      if (WAKE_PHRASES.some((p) => text.includes(p))) {
        rec.stop();
        handleSendFromVoiceRef.current('I need help');
      }
    };
    try {
      rec.start();
    } catch {
      /* noop */
    }
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [handsFreeMode, open, isOffline]);

  const getFullMessage = useCallback((text: string) => {
    const t = text.trim();
    return initialContext ? `[User's pre-filled details: ${initialContext}]\n\n${t}` : t;
  }, [initialContext]);

  const handleSendFromVoice = useCallback(
    (text: string) => {
      if (!text.trim() || sending) return;
      const userMsg: CrissMessage = { id: `u-${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() };
      setMessages((m) => [...m, userMsg]);
      setInput('');
      setSending(true);
      const fullText = getFullMessage(text);
      getCrissChatResponse(fullText, { lastLocation: userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined }, CRISS_SYSTEM_PROMPT)
        .then(({ reply, dispatch }) => {
          const msg: CrissMessage = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: reply,
            timestamp: Date.now(),
            dispatchSuggestion: dispatch,
          };
          setMessages((m) => [...m, msg]);
          if (dispatch) setDispatchLogged(true);
          if (ttsEnabled && isSpeechSynthesisSupported()) {
            setSpeaking(true);
            speakText(reply.replace(/\*\*/g, ''), () => setSpeaking(false));
          }
        })
        .catch(() =>
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: "I'm having trouble. Please try again.", timestamp: Date.now() }])
        )
        .finally(() => setSending(false));
    },
    [sending, userLocation, ttsEnabled, getFullMessage]
  );

  useEffect(() => {
    handleSendFromVoiceRef.current = handleSendFromVoice;
  }, [handleSendFromVoice]);

  const handleMicClick = useCallback(() => {
    if (isOffline) {
      if (recording) {
        mediaRecorderRef.current?.stop();
        setRecording(false);
        setVoiceWaveActive(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const loc = userLocation ?? [0, 0];
          await saveVoiceSos(loc[0], loc[1], blob, 'Voice SOS - Need assistance');
          await saveHelpRequest({ lat: loc[0], lng: loc[1], message: 'Voice SOS - Need assistance', timestamp: Date.now(), ...(guestId && { guestId }) });
          setMessages((m) => [
            ...m,
            {
              id: `a-voice-${Date.now()}`,
              role: 'assistant',
              content: 'Voice SOS recorded and stored with your location. Will sync when connection returns.',
              timestamp: Date.now(),
            },
          ]);
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setRecording(true);
        setVoiceWaveActive(true);
      }).catch(() => {
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: 'Microphone access denied. Please allow microphone to record voice SOS.', timestamp: Date.now() }]);
      });
      return;
    }
    if (listening) {
      stopListeningRef.current?.();
      setListening(false);
      setVoiceWaveActive(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) return;
    setVoiceWaveActive(true);
    const stop = startListening(
      (result) => {
        setInput(result.transcript);
        if (result.isFinal && result.transcript.trim()) {
          setListening(false);
          setVoiceWaveActive(false);
          stopListeningRef.current?.();
          handleSendFromVoice(result.transcript);
        }
      },
      () => {
        setListening(false);
        setVoiceWaveActive(false);
        stopListeningRef.current = null;
      },
      (err) => {
        setListening(false);
        setVoiceWaveActive(false);
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: err, timestamp: Date.now() }]);
      }
    );
    stopListeningRef.current = stop;
    setListening(true);
  }, [isOffline, listening, recording, userLocation, handleSendFromVoice, guestId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: CrissMessage = { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setSending(true);

    const fullText = getFullMessage(text);
    try {
      const { reply, dispatch } = await getCrissChatResponse(
        fullText,
        { lastLocation: userLocation ? { lat: userLocation[0], lng: userLocation[1] } : undefined },
        CRISS_SYSTEM_PROMPT
      );
      const msg: CrissMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
        dispatchSuggestion: dispatch,
      };
      setMessages((m) => [...m, msg]);
      if (dispatch) setDispatchLogged(true);
      if (ttsEnabled && isSpeechSynthesisSupported()) {
        setSpeaking(true);
        speakText(reply.replace(/\*\*/g, ''), () => setSpeaking(false));
      }
    } catch {
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'assistant', content: "I'm having trouble connecting. Please try again.", timestamp: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDispatch = (msg: CrissMessage) => {
    const d = msg.dispatchSuggestion;
    if (!d) return;
    onDispatchConfirm?.(d);
    setMessages((m) => [
      ...m,
      {
        id: `a-confirm-${Date.now()}`,
        role: 'assistant',
        content: `✓ Dispatch confirmed. ${d.hubName} has been notified. ETA ~${d.etaMinutes} min. Stay safe.`,
        timestamp: Date.now(),
      },
    ]);
  };

  const isCritical = (content: string) =>
    content.includes('ETA') || content.includes('logged') || content.includes('coordinator');

  const bg = darkMode ? 'bg-black/95' : 'bg-white';
  const textColor = darkMode ? 'text-amber-100' : 'text-gray-900';
  const borderColor = darkMode ? 'border-amber-500/40' : 'border-gray-200';

  const chatPanel = (
    <div
      className={`flex flex-col overflow-hidden ${bg} ${borderColor} border-2 ${embedded ? 'h-full rounded-xl' : 'fixed bottom-24 right-4 left-4 sm:left-auto sm:w-96 max-h-[70vh] z-[9998] rounded-xl shadow-2xl'}`}
    >
          {dispatchLogged && (
            <div
              className="px-4 py-2 flex items-center gap-2 shrink-0 text-white text-sm font-medium"
              style={{ backgroundColor: '#22c55e' }}
            >
              <span className="animate-pulse">●</span>
              Live Dispatch — Request logged and sent to nearest parish coordinator
            </div>
          )}
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ backgroundColor: NAVY, color: 'white' }}
          >
            <h2 className="font-bold text-base">24/7 Criss Dispatcher</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={handsFreeMode}
                  onChange={(e) => setHandsFreeMode(e.target.checked)}
                  className="rounded"
                />
                Hands-Free
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={ttsEnabled}
                  onChange={(e) => setTtsEnabled(e.target.checked)}
                  className="rounded"
                />
                Speak
              </label>
              {!embedded && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-white/90 hover:text-white text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? darkMode
                        ? 'bg-amber-500/30 text-amber-100'
                        : 'bg-gray-100 text-gray-800'
                      : ''
                  }`}
                  style={
                    msg.role === 'assistant'
                      ? {
                          backgroundColor: isCritical(msg.content) ? SAFETY_RED : NAVY,
                          color: 'white',
                        }
                      : undefined
                  }
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === 'assistant' && isSpeechSynthesisSupported() && (
                    <button
                      type="button"
                      onClick={() => speakText(msg.content.replace(/\*\*/g, ''))}
                      className="mt-2 text-xs opacity-80 hover:opacity-100 flex items-center gap-1"
                      aria-label="Speak aloud"
                    >
                      🔊 Play
                    </button>
                  )}
                  {msg.dispatchSuggestion && (
                    <button
                      type="button"
                      onClick={() => handleConfirmDispatch(msg)}
                      className="mt-3 w-full py-2 rounded-lg font-semibold bg-white text-[#001F3F] hover:bg-gray-100 transition-colors"
                    >
                      Confirm Dispatch
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-2 text-sm text-white" style={{ backgroundColor: NAVY }}>
                  ...
                </div>
              </div>
            )}
            {(listening || recording || speaking) && (
              <div className="flex justify-center py-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: speaking ? SAFETY_RED : NAVY, color: 'white' }}
                >
                  <AudioWaveform active={voiceWaveActive || speaking} color={speaking ? 'red' : 'navy'} />
                  <span className="text-xs font-medium">
                    {listening ? 'Listening...' : recording ? 'Recording...' : speaking ? 'Speaking...' : ''}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={`p-3 border-t ${borderColor} shrink-0`}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMicClick}
                disabled={sending}
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-medium transition-colors ${
                  listening || recording ? 'voice-listening-pulse' : ''
                }`}
                style={{
                  backgroundColor: listening || recording ? SAFETY_RED : NAVY,
                  color: 'white',
                }}
                aria-label={isOffline ? (recording ? 'Stop recording' : 'Record voice SOS') : listening ? 'Stop listening' : 'Start voice input'}
              >
                {listening || recording ? '⏹' : '🎤'}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={listening ? 'Listening...' : recording ? 'Recording...' : 'Type or use mic...'}
                disabled={sending}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm border-2 focus:outline-none focus:ring-2 ${borderColor} ${textColor} placeholder-gray-500`}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="shrink-0 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: NAVY }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
  );

  return (
    <>
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-lg transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: NAVY }}
          aria-label="Talk to Criss"
        >
          💬
        </button>
      )}
      {(open || embedded) && chatPanel}
    </>
  );
}
