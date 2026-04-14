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
  const language = String(accent || "en_us").toLowerCase();

  const languageMap = {
    en_us: "English",
    en_br: "English",
    zh_cn: "Mandarin Chinese",
    ja_jp: "Japanese",
    ko_kr: "Korean",
    es_es: "Spanish",
    de_de: "German",
    fr_fr: "French",
    ru_ru: "Russian",
    ar_sa: "Arabic",
  };

  const selectedLanguageLabel = languageMap[language] || "English";

  const selectedVoice =
    language === "en_br" ? "cedar" :
    language === "zh_cn" ? "alloy" :
    language === "ja_jp" ? "alloy" :
    language === "ko_kr" ? "alloy" :
    language === "es_es" ? "alloy" :
    language === "de_de" ? "alloy" :
    language === "fr_fr" ? "alloy" :
    language === "ru_ru" ? "alloy" :
    language === "ar_sa" ? "alloy" :
    "marin";

  const useAzurePlayback = false;

  console.log("[realtimeConversation] accent =", accent);
  console.log("[realtimeConversation] language =", language);
  console.log("[realtimeConversation] selectedVoice =", selectedVoice);
  let pc = null;
  let dc = null;
  let localStream = null;
  let remoteAudioEl = null;
  let localAudioTrack = null;
  let isConnected = false;
  let remoteAudioContext = null;
  let remoteGainNode = null;
  let remoteCompressorNode = null;
  let remoteSourceNode = null;

let mediaRecorder = null;
let mediaRecorderMimeType = "";
let recordingChunks = [];
let currentRecordingPromise = null;
let resolveCurrentRecording = null;

let practiceStream = null;
let practiceRecorder = null;
let practiceRecorderMimeType = "";
let practiceChunks = [];
let currentPracticePromise = null;
let resolveCurrentPractice = null;
let isUserInputActive = false;
let isPracticeInputActive = false;

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
async function startPracticeRecording() {
  if (practiceRecorder && practiceRecorder.state === "recording") return true;
  if (isPracticeInputActive) return true;

  isPracticeInputActive = true;

  interruptAssistant();

  try {
    practiceStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    practiceRecorderMimeType = pickSupportedMimeType();
    practiceChunks = [];
    currentPracticePromise = new Promise((resolve) => {
      resolveCurrentPractice = resolve;
    });

    practiceRecorder = practiceRecorderMimeType
      ? new MediaRecorder(practiceStream, { mimeType: practiceRecorderMimeType })
      : new MediaRecorder(practiceStream);

    practiceRecorder.ondataavailable = (event) => {
      if (event?.data && event.data.size > 0) {
        practiceChunks.push(event.data);
      }
    };

    practiceRecorder.onstop = async () => {
      try {
        const blobType = practiceRecorderMimeType || practiceChunks?.[0]?.type || "audio/webm";
        const blob = new Blob(practiceChunks, { type: blobType });
        const base64 = blob.size > 0 ? await blobToBase64(blob) : "";

        resolveCurrentPractice?.({
          blob,
          mimeType: blobType,
          base64,
          size: blob.size,
        });
      } catch (err) {
        resolveCurrentPractice?.({
          blob: null,
          mimeType: practiceRecorderMimeType || "audio/webm",
          base64: "",
          size: 0,
          error: err?.message || "Failed to build practice blob",
        });
          } finally {
        try {
          if (practiceStream) {
            practiceStream.getTracks().forEach((t) => t.stop());
          }
        } catch {}

        isPracticeInputActive = false;
        practiceStream = null;
        practiceRecorder = null;
        practiceRecorderMimeType = "";
        practiceChunks = [];
        currentPracticePromise = null;
        resolveCurrentPractice = null;
      }
    };

    practiceRecorder.start();
    return true;
    } catch (err) {
    safeEmitError(err);
    isPracticeInputActive = false;
    currentPracticePromise = null;
    resolveCurrentPractice = null;

    try {
      if (practiceStream) {
        practiceStream.getTracks().forEach((t) => t.stop());
      }
    } catch {}

    practiceStream = null;
    practiceRecorder = null;
    practiceRecorderMimeType = "";
    practiceChunks = [];
    return false;
  }
}

function stopPracticeRecording() {
  isPracticeInputActive = false;

  if (!practiceRecorder) {
    return Promise.resolve({
      blob: null,
      mimeType: "",
      base64: "",
      size: 0,
    });
  }

  if (practiceRecorder.state !== "recording") {
    return (
      currentPracticePromise ||
      Promise.resolve({
        blob: null,
        mimeType: practiceRecorderMimeType || "",
        base64: "",
        size: 0,
      })
    );
  }

  const pending =
    currentPracticePromise ||
    Promise.resolve({
      blob: null,
      mimeType: practiceRecorderMimeType || "",
      base64: "",
      size: 0,
    });

  try {
    practiceRecorder.stop();
  } catch (err) {
    safeEmitError(err);
    return Promise.resolve({
      blob: null,
      mimeType: practiceRecorderMimeType || "",
      base64: "",
      size: 0,
      error: err?.message || "Failed to stop practice recording",
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
      body: JSON.stringify({ accent, language }),
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
    remoteAudioEl.volume = 1;

    pc.ontrack = async (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          throw new Error("Web Audio API not available");
        }

        if (!remoteAudioContext) {
          remoteAudioContext = new AudioCtx();
        }

        if (remoteAudioContext.state === "suspended") {
          await remoteAudioContext.resume();
        }

         if (remoteSourceNode) {
          try { remoteSourceNode.disconnect(); } catch {}
        }
        if (remoteCompressorNode) {
          try { remoteCompressorNode.disconnect(); } catch {}
        }
        if (remoteGainNode) {
          try { remoteGainNode.disconnect(); } catch {}
        }

        remoteSourceNode = remoteAudioContext.createMediaStreamSource(stream);

        remoteCompressorNode = remoteAudioContext.createDynamicsCompressor();
        remoteCompressorNode.threshold.value = -24;
        remoteCompressorNode.knee.value = 18;
        remoteCompressorNode.ratio.value = 10;
        remoteCompressorNode.attack.value = 0.003;
        remoteCompressorNode.release.value = 0.2;

        remoteGainNode = remoteAudioContext.createGain();
        remoteGainNode.gain.value = 1.35;

       remoteSourceNode.connect(remoteCompressorNode);
remoteCompressorNode.connect(remoteGainNode);

remoteGainNode.connect(remoteAudioContext.destination);

        if (typeof onRemoteAudio === "function") onRemoteAudio(null, stream);
      } catch (err) {
        console.error("[realtimeConversation] remote gain setup failed", err);
        safeEmitError(err);
      }
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

console.log("[realtimeConversation] sending session.update voice =", selectedVoice);
sendEvent({
  type: "session.update",
  session: {
    type: "realtime",
    instructions:
      `You are a friendly ${selectedLanguageLabel} conversation coach for everyday learners. Speak only in ${selectedLanguageLabel} at all times. Keep the conversation simple, natural, and easy to follow. Only talk about normal everyday topics such as daily life, hobbies, food, weekend plans, friends, family, travel, work, movies, music, exercise, weather, shopping, and routines. Do not switch to English unless the user explicitly asks for English. Sound like a normal friendly person, not a teacher giving a lecture. Keep responses concise and natural.`,
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          create_response: false,
          interrupt_response: true,
        },
      },
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
        `Speak only in ${selectedLanguageLabel}. Start with a short, natural greeting. Then ask what the user wants to talk about today and briefly suggest only normal everyday topics like weekend plans, hobbies, food, travel, work, movies, music, daily routines, friends, family, weather, or exercise. Do not switch to English unless the user explicitly asks for English. Keep it simple, natural, and not too long.`,
    },
  });
}
function requestAssistantReply() {
  return sendEvent({
    type: "response.create",
    response: {
      instructions:
        `Speak only in ${selectedLanguageLabel}. Respond naturally to the user's most recent message in the ongoing conversation. Follow up on what the user actually said most recently. Do not switch into pronunciation practice mode. Do not ask what word they want to practice. Do not mention pronunciation unless the user asks about it. Keep it concise and natural, and ask only one short follow-up question.`,
    },
  });
}
  function interruptAssistant() {
    sendEvent({ type: "response.cancel" });
    sendEvent({ type: "output_audio_buffer.clear" });
  }

function startUserInput() {
  if (!isConnected || !localAudioTrack) return false;
  if (isUserInputActive) return true;

  isUserInputActive = true;

  interruptAssistant();

  try {
    localAudioTrack.enabled = true;
  } catch {}

  const ok = startLocalRecording();
  if (!ok) {
    isUserInputActive = false;
    try {
      localAudioTrack.enabled = false;
    } catch {}
    return false;
  }

  return true;
}

function stopUserInput() {
  isUserInputActive = false;

  if (!localAudioTrack) {
    return Promise.resolve({
      ok: false,
      blob: null,
      mimeType: "",
      base64: "",
      size: 0,
    });
  }

  try {
    localAudioTrack.enabled = false;
  } catch {}

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
    try {
      if (remoteSourceNode) remoteSourceNode.disconnect();
    } catch {}

    try {
      if (remoteCompressorNode) remoteCompressorNode.disconnect();
    } catch {}

    try {
      if (remoteGainNode) remoteGainNode.disconnect();
    } catch {}

    try {
      if (remoteAudioContext) remoteAudioContext.close();
    } catch {}

 try {
  if (practiceRecorder && practiceRecorder.state === "recording") {
    practiceRecorder.stop();
  }
} catch {}

try {
  if (practiceStream) {
    practiceStream.getTracks().forEach((t) => t.stop());
  }
} catch {}

remoteSourceNode = null;
remoteCompressorNode = null;
remoteGainNode = null;
remoteAudioContext = null;
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

practiceStream = null;
practiceRecorder = null;
practiceRecorderMimeType = "";
practiceChunks = [];
currentPracticePromise = null;
resolveCurrentPractice = null;
isUserInputActive = false;
isPracticeInputActive = false;
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
  startPracticeRecording,
  stopPracticeRecording,
};
}