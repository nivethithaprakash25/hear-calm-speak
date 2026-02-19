import { useRef, useCallback, useEffect, useState } from "react";

export function useVoiceAlert() {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const queueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const lastSpokenRef = useRef<Map<string, number>>(new Map());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const speakNext = useCallback(() => {
    if (!synthRef.current || queueRef.current.length === 0 || isSpeakingRef.current) return;
    const text = queueRef.current.shift()!;
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick a clear voice if available
    const voices = synthRef.current.getVoices();
    const preferred = voices.find((v) =>
      v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha"))
    ) || voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      speakNext();
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      speakNext();
    };

    synthRef.current.speak(utterance);
  }, []);

  const speak = useCallback(
    (message: string, cooldownMs = 8000) => {
      if (!voiceEnabled || !synthRef.current) return;

      // Deduplicate / cooldown
      const key = message.replace(/[^a-zA-Z ]/g, "").toLowerCase().slice(0, 40);
      const lastTime = lastSpokenRef.current.get(key) || 0;
      if (Date.now() - lastTime < cooldownMs) return;
      lastSpokenRef.current.set(key, Date.now());

      // Clean up emoji for TTS
      const clean = message.replace(/[\u{1F600}-\u{1FFFF}]/gu, "").trim();
      queueRef.current.push(clean);
      speakNext();
    },
    [voiceEnabled, speakNext]
  );

  const cancelSpeech = useCallback(() => {
    synthRef.current?.cancel();
    queueRef.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) cancelSpeech();
      return !prev;
    });
  }, [cancelSpeech]);

  return { speak, cancelSpeech, toggleVoice, voiceEnabled, isSpeaking };
}
