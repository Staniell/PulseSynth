// PulseSynth Offscreen Document Script
// Handles audio capture and analysis

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let analyserNode: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

// Start audio stream processing
async function startAudioStream(streamId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the media stream using the stream ID
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      } as MediaTrackConstraints,
      video: false,
    });

    console.log("[PulseSynth:Offscreen] Got media stream:", mediaStream);

    // Create audio context
    audioContext = new AudioContext();
    console.log("[PulseSynth:Offscreen] AudioContext state:", audioContext.state);

    // Create analyser node
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256; // Per rules: 256-512
    analyserNode.smoothingTimeConstant = 0.8;

    // Create source from stream
    sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // Connect: source -> analyser
    sourceNode.connect(analyserNode);

    // IMPORTANT: Connect to destination so user can still hear audio
    // Otherwise the tab audio will be muted
    analyserNode.connect(audioContext.destination);

    console.log("[PulseSynth:Offscreen] Audio pipeline connected.");
    console.log("[PulseSynth:Offscreen] FFT size:", analyserNode.fftSize);
    console.log("[PulseSynth:Offscreen] Frequency bin count:", analyserNode.frequencyBinCount);

    // Start a simple logging loop to verify audio is flowing
    startAudioMonitor();

    return { success: true };
  } catch (error) {
    console.error("[PulseSynth:Offscreen] Failed to start audio stream:", error);
    return { success: false, error: String(error) };
  }
}

// Stop audio stream
function stopAudioStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  console.log("[PulseSynth:Offscreen] Audio stream stopped and cleaned up.");
}

// Simple audio monitor for verification (Phase 2 only)
let monitorInterval: number | null = null;

function startAudioMonitor() {
  if (monitorInterval) return;

  const dataArray = new Uint8Array(analyserNode!.frequencyBinCount);

  monitorInterval = window.setInterval(() => {
    if (!analyserNode) {
      stopAudioMonitor();
      return;
    }

    analyserNode.getByteFrequencyData(dataArray);

    // Calculate simple average
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;

    // Log occasionally to verify audio is flowing
    console.log("[PulseSynth:Offscreen] Audio level:", average.toFixed(2));
  }, 1000); // Log every second for Phase 2 verification
}

function stopAudioMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Only handle messages targeted at offscreen
  if (message.target !== "offscreen") {
    return false;
  }

  switch (message.type) {
    case "START_AUDIO_STREAM":
      startAudioStream(message.streamId).then(sendResponse);
      return true; // Will respond asynchronously

    case "STOP_AUDIO_STREAM":
      stopAudioMonitor();
      stopAudioStream();
      sendResponse({ success: true });
      return false;

    default:
      return false;
  }
});

console.log("[PulseSynth:Offscreen] Offscreen document loaded and ready.");
