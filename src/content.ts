// PulseSynth Content Script
// Receives audio data from background and manages WebGL overlay

import { initRenderer, startRenderLoop, stopRenderLoop, updateAudioData, destroyRenderer } from "./renderer";

// Audio band data structure
interface AudioBands {
  bass: number;
  mids: number;
  highs: number;
  energy: number;
}

// Current audio data
let currentAudioData: AudioBands = {
  bass: 0,
  mids: 0,
  highs: 0,
  energy: 0,
};

// Renderer state
let isRendererActive = false;
let logThrottle = 0;

// Initialize renderer when capture starts
function startVisualizer() {
  if (isRendererActive) return;

  const canvas = initRenderer();
  if (canvas) {
    document.body.appendChild(canvas);
    startRenderLoop();
    isRendererActive = true;
    console.log("[PulseSynth:Content] Visualizer started.");
  }
}

// Stop renderer when capture stops
function stopVisualizer() {
  if (!isRendererActive) return;

  stopRenderLoop();
  destroyRenderer();
  isRendererActive = false;
  console.log("[PulseSynth:Content] Visualizer stopped.");
}

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === "AUDIO_DATA" && message.data) {
    // Start visualizer on first audio data
    if (!isRendererActive) {
      startVisualizer();
    }

    currentAudioData = message.data;
    updateAudioData(currentAudioData);

    // Throttled logging (every 60 frames = ~1 second)
    logThrottle++;
    if (logThrottle >= 60) {
      logThrottle = 0;
      console.log(
        `[PulseSynth:Content] Bass: ${currentAudioData.bass.toFixed(3)} | Mids: ${currentAudioData.mids.toFixed(
          3
        )} | Highs: ${currentAudioData.highs.toFixed(3)}`
      );
    }
  } else if (message.type === "STOP_VISUALIZER") {
    stopVisualizer();
  }
  return false;
});

console.log("[PulseSynth:Content] Content script loaded.");
