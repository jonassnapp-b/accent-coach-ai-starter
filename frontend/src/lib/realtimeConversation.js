// frontend/src/lib/realtimeConversation.js

const REALTIME_MODEL = "gpt-realtime";

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
  let pc = null;
  let dc = null;
  let localStream = null;
  let remoteAudioEl = null;
  let localAudioTrack = null;
  let isConnected = false;

  function safeEmitError(err) {
    console.error("[realtimeConversation]", err);
    if (typeof onError === "function") onError(err);
  }

  function sendEvent(evt) {
    if (!dc || dc.readyState !== "open") return false;
    dc.send(JSON.stringify(evt));
    return true;
  }

  async function connect() {
    const tokenRes = await fetch("/api/realtime-session", {
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

    const sdpRes = await fetch(
      `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
      {
        method: "POST",
     headers: {
  Authorization: `Bearer ${ephemeralKey}`,
  "Content-Type": "application/sdp",
},
        body: offer.sdp,
      }
    );

    const answerSdp = await sdpRes.text();

    if (!sdpRes.ok) {
      throw new Error(answerSdp || `Realtime SDP failed (${sdpRes.status})`);
    }

    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });

    await waitForDataChannelOpen(dc);
    isConnected = true;
  }

  function startAssistantGreeting() {
    return sendEvent({
      type: "response.create",
      response: {
        instructions:
          "Start the conversation now. Ask what the user wants to talk about today and naturally offer many possible topics. Do not mention scenarios.",
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
    return true;
  }

  function stopUserInput() {
    if (!localAudioTrack) return false;
    localAudioTrack.enabled = false;
    return true;
  }

  function disconnect() {
    try {
      if (localAudioTrack) localAudioTrack.enabled = false;
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
    isConnected = false;
  }

  return {
    connect,
    disconnect,
    sendEvent,
    interruptAssistant,
    startAssistantGreeting,
    startUserInput,
    stopUserInput,
  };
}