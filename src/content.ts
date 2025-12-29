// PulseSynth Content Script
// Receives audio data from background and manages WebGL overlay

import {
  initRenderer,
  startRenderLoop,
  stopRenderLoop,
  updateAudioData,
  updateSettings,
  destroyRenderer,
} from "./renderer";

// Audio band data structure
interface AudioBands {
  bass: number;
  mids: number;
  highs: number;
  energy: number;
}

// Settings interface
interface Settings {
  intensity: number;
  glowWidth: number;
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

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(["pulseSynthSettings"], (result) => {
    const settings = result.pulseSynthSettings as Settings | undefined;
    if (settings) {
      updateSettings(settings);
    }
  });
}

// Initialize renderer when capture starts
function startVisualizer() {
  if (isRendererActive) return;

  const canvas = initRenderer();
  if (canvas) {
    document.body.appendChild(canvas);
    startRenderLoop();
    loadSettings(); // Apply saved settings
    isRendererActive = true;
  }
}

// Stop renderer when capture stops
function stopVisualizer() {
  if (!isRendererActive) return;

  stopRenderLoop();
  destroyRenderer();
  isRendererActive = false;
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
    }
  } else if (message.type === "UPDATE_SETTINGS" && message.settings) {
    updateSettings(message.settings);
  } else if (message.type === "STOP_VISUALIZER") {
    stopVisualizer();
  }
  return false;
});

// Loaded
