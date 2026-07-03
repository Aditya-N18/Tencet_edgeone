import { useCallback, useEffect, useRef, useState } from "react";
import { assistantId, getVapiClient, isVapiConfigured } from "@/lib/vapi";

export function useVapiSession({ incident, onCallEnd } = {}) {
  const [sessionActive, setSessionActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const [sdkReady, setSdkReady] = useState(false);
  const handlersRef = useRef(null);

  useEffect(() => {
    if (!isVapiConfigured) return undefined;
    let cancelled = false;
    getVapiClient()
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load Vapi");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unbind = useCallback(() => {
    const h = handlersRef.current;
    if (!h?.vapi) return;
    h.vapi.removeListener("call-start", h.onCallStart);
    h.vapi.removeListener("call-end", h.onCallEnd);
    h.vapi.removeListener("speech-start", h.onSpeechStart);
    h.vapi.removeListener("speech-end", h.onSpeechEnd);
    h.vapi.removeListener("message", h.onMessage);
    h.vapi.removeListener("error", h.onError);
    handlersRef.current = null;
  }, []);

  const bind = useCallback(
    async (vapi) => {
      if (!vapi || handlersRef.current) return;

      const onCallStart = () => {
        setSessionActive(true);
        setListening(true);
        setError(null);
      };
      const onCallEnd = () => {
        setSessionActive(false);
        setListening(false);
        setError(null);
        onCallEnd?.();
      };
      const onSpeechStart = () => setListening(true);
      const onSpeechEnd = () => setListening(false);
      const onMessage = (message) => {
        if (
          message?.type === "transcript" &&
          message.transcriptType === "final"
        ) {
          const line =
            message.role === "assistant"
              ? `Assistant: ${message.transcript}`
              : `You: ${message.transcript}`;
          setTranscript((prev) => (prev ? `${prev}\n${line}` : line));
        }
      };
      const onError = (e) => {
        setError(
          typeof e === "string" ? e : (e?.message ?? "Voice session error"),
        );
        setSessionActive(false);
        setListening(false);
      };

      vapi.on("call-start", onCallStart);
      vapi.on("call-end", onCallEnd);
      vapi.on("speech-start", onSpeechStart);
      vapi.on("speech-end", onSpeechEnd);
      vapi.on("message", onMessage);
      vapi.on("error", onError);

      handlersRef.current = {
        vapi,
        onCallStart,
        onCallEnd,
        onSpeechStart,
        onSpeechEnd,
        onMessage,
        onError,
      };
    },
    [onCallEnd],
  );

  useEffect(
    () => () => {
      unbind();
      handlersRef.current?.vapi?.stop();
    },
    [unbind],
  );

  const startSession = useCallback(
    async (incidentOverride) => {
      if (!isVapiConfigured) {
        setError(
          "Vapi is not configured. Add keys to frontend/.env and run scripts/setup-vapi-assistant.mjs",
        );
        return false;
      }

      const active = incidentOverride ?? incident

      try {
        const vapi = await getVapiClient();
        await bind(vapi);

        const variableValues = {
          senior_name: "Margaret",
          senior_id: active?.senior_id || "senior_001",
          incident_id: active?.id || "manual-session",
          alert_reason: active?.reason || "wellness check",
          confidence: String(active?.confidence ?? "0"),
        };

        await vapi.start(assistantId, { variableValues });
        return true;
      } catch (err) {
        setError(err?.message ?? "Could not start voice session");
        return false;
      }
    },
    [bind, incident],
  );

  const endSession = useCallback(async () => {
    const vapi = handlersRef.current?.vapi || (await getVapiClient());
    vapi?.stop();
    setSessionActive(false);
    setListening(false);
    setError(null);
  }, []);

  return {
    isConfigured: isVapiConfigured && sdkReady,
    sessionActive,
    listening,
    transcript,
    error,
    startSession,
    endSession,
  };
}
