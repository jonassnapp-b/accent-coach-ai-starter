// frontend/src/lib/realtimeConversation.js

const REALTIME_MODEL = "gpt-realtime";
function isNative() {
  return !!(window?.Capacitor && window.Capacitor.isNativePlatform);
}

function getApiBase() {
  const ls = (typeof localStorage !== "undefined" && localStorage.getItem("apiBase")) || "";
  const env = (import.meta?.env && import.meta.env.VITE_API_BASE) || "";
  if (isNative()) {
    const base = (ls || env).replace(/\/+$/, "");
    if (!base) throw new Error("VITE_API_BASE (or localStorage.apiBase) is not set — required on iOS.");
    return base;
  }
  return (ls || env || window.location.origin).replace(/\/+$/, "");
}
function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/webm;codecs=opus",
  "audio/webm",
];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {}
  }
  return "";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 || "");
    };
    reader.onerror = () => reject(new Error("Failed to read recorded audio"));
    reader.readAsDataURL(blob);
  });
}
function waitForDataChannelOpen(dc, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!dc) {
      reject(new Error("Missing data channel"));
      return;
    }

    if (dc.readyState === "open") {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Realtime data channel timed out"));
    }, timeoutMs);

    function handleOpen() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();
      reject(new Error("Realtime data channel failed to open"));
    }

    function cleanup() {
      clearTimeout(timer);
      dc.removeEventListener("open", handleOpen);
      dc.removeEventListener("error", handleError);
    }

    dc.addEventListener("open", handleOpen);
    dc.addEventListener("error", handleError);
  });
}

export async function createRealtimeConversation({
  accent = "en_us",
  onRemoteAudio,
  onMessage,
  onError,
}) {
    const selectedVoice = accent === "en_br" ? "cedar" : "marin";
  let pc = null;
  let dc = null;
  let localStream = null;
  let remoteAudioEl = null;
  let localAudioTrack = null;
  let isConnected = false;

  let mediaRecorder = null;
  let mediaRecorderMimeType = "";
  let recordingChunks = [];
  let currentRecordingPromise = null;
  let resolveCurrentRecording = null;

  function safeEmitError(err) {
    console.error("[realtimeConversation]", err);
    if (typeof onError === "function") onError(err);
  }

  function sendEvent(evt) {
    if (!dc || dc.readyState !== "open") return false;
    dc.send(JSON.stringify(evt));
    return true;
  }
  function ensureRecorderReady() {
    if (!localStream) return false;
    if (mediaRecorder) return true;

    try {
      mediaRecorderMimeType = pickSupportedMimeType();
      console.log("[realtimeConversation] picked mime =", mediaRecorderMimeType);
      mediaRecorder = mediaRecorderMimeType
        ? new MediaRecorder(localStream, { mimeType: mediaRecorderMimeType })
        : new MediaRecorder(localStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event?.data && event.data.size > 0) {
          recordingChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blobType = mediaRecorderMimeType || recordingChunks?.[0]?.type || "audio/webm";
          const blob = new Blob(recordingChunks, { type: blobType });
          const base64 = blob.size > 0 ? await blobToBase64(blob) : "";
          resolveCurrentRecording?.({
            blob,
            mimeType: blobType,
            base64,
            size: blob.size,
          });
        } catch (err) {
          resolveCurrentRecording?.({
            blob: null,
            mimeType: mediaRecorderMimeType || "audio/webm",
            base64: "",
            size: 0,
            error: err?.message || "Failed to build recording blob",
          });
        } finally {
          recordingChunks = [];
          currentRecordingPromise = null;
          resolveCurrentRecording = null;
        }
      };

      return true;
    } catch (err) {
      safeEmitError(err);
      return false;
    }
  }

  function startLocalRecording() {
    if (!ensureRecorderReady() || !mediaRecorder) return false;
    if (mediaRecorder.state === "recording") return true;

    try {
      recordingChunks = [];
      currentRecordingPromise = new Promise((resolve) => {
        resolveCurrentRecording = resolve;
      });
      mediaRecorder.start();
      return true;
    } catch (err) {
      safeEmitError(err);
      currentRecordingPromise = null;
      resolveCurrentRecording = null;
      return false;
    }
  }

  function stopLocalRecording() {
    if (!mediaRecorder) {
      return Promise.resolve({
        blob: null,
        mimeType: "",
        base64: "",
        size: 0,
      });
    }

    if (mediaRecorder.state !== "recording") {
      return (
        currentRecordingPromise ||
        Promise.resolve({
          blob: null,
          mimeType: mediaRecorderMimeType || "",
          base64: "",
          size: 0,
        })
      );
    }

    const pending =
      currentRecordingPromise ||
      Promise.resolve({
        blob: null,
        mimeType: mediaRecorderMimeType || "",
        base64: "",
        size: 0,
      });

    try {
      mediaRecorder.stop();
    } catch (err) {
      safeEmitError(err);
      return Promise.resolve({
        blob: null,
        mimeType: mediaRecorderMimeType || "",
        base64: "",
        size: 0,
        error: err?.message || "Failed to stop local recording",
      });
    }

    return pending;
  }
async function connect() {
  const base = getApiBase();
console.log("[realtimeConversation] realtime-session URL =", `${base}/api/realtime-session`);
  const tokenRes = await fetch(`${base}/api/realtime-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent }),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      throw new Error(
        tokenData?.error ||
          tokenData?.detail?.error?.message ||
          tokenData?.detail ||
          "Failed to get realtime session token"
      );
    }

    const ephemeralKey =
  tokenData?.client_secret?.value ||
  tokenData?.value ||
  "";
    if (!ephemeralKey) {
      throw new Error("Missing realtime client secret");
    }

    pc = new RTCPeerConnection();

    remoteAudioEl = document.createElement("audio");
    remoteAudioEl.autoplay = true;
    remoteAudioEl.playsInline = true;
    remoteAudioEl.volume = 0.35;

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      remoteAudioEl.srcObject = stream;
      if (typeof onRemoteAudio === "function") onRemoteAudio(remoteAudioEl, stream);
    };

    dc = pc.createDataChannel("oai-events");

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (typeof onMessage === "function") onMessage(msg);
      } catch (err) {
        safeEmitError(new Error("Bad realtime data channel message"));
      }
    };

    dc.onerror = (err) => {
      safeEmitError(err || new Error("Realtime data channel error"));
    };

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    localAudioTrack = localStream.getAudioTracks?.()[0] || null;
    if (!localAudioTrack) {
      throw new Error("No microphone track found");
    }

    // Start muted/disabled until user holds the button
    localAudioTrack.enabled = false;

    pc.addTrack(localAudioTrack, localStream);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

   const formData = new FormData();
formData.append("sdp", offer.sdp);
formData.append(
  "session",
  JSON.stringify({
    type: "realtime",
    model: REALTIME_MODEL
  })
);

const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${ephemeralKey}`,
  },
  body: formData,
});

    const answerSdp = await sdpRes.text();

    if (!sdpRes.ok) {
      throw new Error(answerSdp || `Realtime SDP failed (${sdpRes.status})`);
    }

    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });

await waitForDataChannelOpen(dc);

sendEvent({
  type: "session.update",
  session: {
    type: "realtime",
    instructions:
      "You are an English conversation coach. Speak only in English at all times. Never use Portuguese or any other language. Keep responses concise and natural.",
    audio: {
      output: {
        voice: selectedVoice,
      },
    },
  },
});

isConnected = true;
  }
  
function startAssistantGreeting() {
  return sendEvent({
    type: "response.create",
    response: {
      instructions:
        "Speak only in English. Start with a short, natural greeting. Ask what the user wants to talk about today, then briefly offer a few possible topics in one concise sentence. Keep it simple and not too long.",
    },
  });
}
function requestAssistantReply() {
  return sendEvent({
    type: "response.create",
    response: {
      instructions:
        "Speak only in English. Continue the conversation naturally based on what the user just said. Keep it concise. Ask only one short follow-up question.",
    },
  });
}
  function interruptAssistant() {
    sendEvent({ type: "response.cancel" });
    sendEvent({ type: "output_audio_buffer.clear" });
  }

  function startUserInput() {
    if (!isConnected || !localAudioTrack) return false;

    interruptAssistant();
    localAudioTrack.enabled = true;
    startLocalRecording();
    return true;
  }

  function stopUserInput() {
    if (!localAudioTrack) {
      return Promise.resolve({
        ok: false,
        blob: null,
        mimeType: "",
        base64: "",
        size: 0,
      });
    }

    localAudioTrack.enabled = false;

    return stopLocalRecording().then((result) => ({
      ok: true,
      ...(result || {}),
    }));
  }

  function disconnect() {
    try {
      if (localAudioTrack) localAudioTrack.enabled = false;
    } catch {}
    try {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    } catch {}
    try {
      if (dc) dc.close();
    } catch {}

    try {
      if (pc) pc.close();
    } catch {}

    try {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    } catch {}

    try {
      if (remoteAudioEl) {
        remoteAudioEl.pause();
        remoteAudioEl.srcObject = null;
      }
    } catch {}

     dc = null;
    pc = null;
    localStream = null;
    localAudioTrack = null;
    remoteAudioEl = null;
    mediaRecorder = null;
    mediaRecorderMimeType = "";
    recordingChunks = [];
    currentRecordingPromise = null;
    resolveCurrentRecording = null;
    isConnected = false;
  }

  return {
    connect,
    disconnect,
    sendEvent,
    interruptAssistant,
    startAssistantGreeting,
    requestAssistantReply,
    startUserInput,
    stopUserInput,
  };
}