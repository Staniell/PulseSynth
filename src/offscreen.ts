// PulseSynth Offscreen Document Script
// Handles audio capture and analysis

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let analyserNode: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

// Reusable typed array (per performance rules - no per-frame allocations)
let frequencyData: Uint8Array | null = null;

// Smoothed audio band values (EMA)
let smoothedBass = 0;
let smoothedMids = 0;
let smoothedHighs = 0;
let smoothedEnergy = 0;

// EMA smoothing factor (0.3 = responsive but stable)
const SMOOTHING_ALPHA = 0.3;

// FFT bin ranges for 256 FFT size @ 44.1kHz sample rate
// Each bin = sampleRate / fftSize = 44100 / 256 ≈ 172 Hz per bin
// Bass: 0-250 Hz → bins 0-1
// Mids: 250-4000 Hz → bins 2-23
// Highs: 4000-20000 Hz → bins 24-127
const BASS_END_BIN = 2; // ~344 Hz
const MIDS_END_BIN = 24; // ~4128 Hz

// Audio band data structure
interface AudioBands {
  bass: number;
  mids: number;
  highs: number;
  energy: number;
}

// Calculate average of a range in the frequency array
function getAverageInRange(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  const count = end - start;
  for (let i = start; i < end; i++) {
    sum += data[i];
  }
  return count > 0 ? sum / count / 255 : 0; // Normalize to 0-1
}

// Apply EMA smoothing
function smooth(current: number, previous: number): number {
  return SMOOTHING_ALPHA * current + (1 - SMOOTHING_ALPHA) * previous;
}

// Analyze audio and return band values
function analyzeAudio(): AudioBands {
  if (!analyserNode || !frequencyData) {
    return { bass: 0, mids: 0, highs: 0, energy: 0 };
  }

  // Get frequency data
  const data = frequencyData;
  analyserNode.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);

  const binCount = data.length;

  // Calculate raw band values
  const rawBass = getAverageInRange(data, 0, BASS_END_BIN);
  const rawMids = getAverageInRange(data, BASS_END_BIN, MIDS_END_BIN);
  const rawHighs = getAverageInRange(data, MIDS_END_BIN, binCount);

  // Calculate overall energy (RMS-like)
  let totalEnergy = 0;
  for (let i = 0; i < binCount; i++) {
    totalEnergy += data[i];
  }
  const rawEnergy = totalEnergy / binCount / 255;

  // Apply smoothing
  smoothedBass = smooth(rawBass, smoothedBass);
  smoothedMids = smooth(rawMids, smoothedMids);
  smoothedHighs = smooth(rawHighs, smoothedHighs);
  smoothedEnergy = smooth(rawEnergy, smoothedEnergy);

  return {
    bass: smoothedBass,
    mids: smoothedMids,
    highs: smoothedHighs,
    energy: smoothedEnergy,
  };
}

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
    console.log("[PulseSynth:Offscreen] Sample rate:", audioContext.sampleRate);

    // Create analyser node
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256; // Per rules: 256-512
    analyserNode.smoothingTimeConstant = 0.8;

    // Initialize reusable frequency data array
    frequencyData = new Uint8Array(analyserNode.frequencyBinCount);

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

    // Start the audio data streaming loop
    startAudioDataStream();

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
  frequencyData = null;

  // Reset smoothed values
  smoothedBass = 0;
  smoothedMids = 0;
  smoothedHighs = 0;
  smoothedEnergy = 0;

  console.log("[PulseSynth:Offscreen] Audio stream stopped and cleaned up.");
}

// Audio data streaming using setInterval (requestAnimationFrame doesn't work in offscreen docs)
let streamingInterval: number | null = null;
const STREAM_INTERVAL_MS = 16; // ~60fps

function startAudioDataStream() {
  if (streamingInterval) return;

  console.log("[PulseSynth:Offscreen] Starting audio data stream via setInterval.");

  streamingInterval = window.setInterval(() => {
    if (!analyserNode) {
      stopAudioDataStream();
      return;
    }

    const bands = analyzeAudio();

    // Send audio data to background
    chrome.runtime
      .sendMessage({
        type: "AUDIO_DATA",
        data: bands,
      })
      .then(() => {
        // Sent successfully
      })
      .catch((err) => {
        console.error("[PulseSynth:Offscreen] Failed to send AUDIO_DATA:", err);
      });
  }, STREAM_INTERVAL_MS);
}

function stopAudioDataStream() {
  if (streamingInterval) {
    clearInterval(streamingInterval);
    streamingInterval = null;
    console.log("[PulseSynth:Offscreen] Stopped audio data stream.");
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
      stopAudioDataStream();
      stopAudioStream();
      sendResponse({ success: true });
      return false;

    default:
      return false;
  }
});

console.log("[PulseSynth:Offscreen] Offscreen document loaded and ready.");
