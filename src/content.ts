// PulseSynth Content Script
// Receives audio data from background and stores it for rendering

// Audio band data structure
interface AudioBands {
  bass: number;
  mids: number;
  highs: number;
  energy: number;
}

// Current audio data (will be used by renderer in Phase 5)
let currentAudioData: AudioBands = {
  bass: 0,
  mids: 0,
  highs: 0,
  energy: 0,
};

// Expose to global scope for renderer (Phase 5)
(window as { pulseSynthAudioData?: AudioBands }).pulseSynthAudioData = currentAudioData;

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  console.log("[PulseSynth:Content] Received message:", message.type);

  if (message.type === "AUDIO_DATA" && message.data) {
    currentAudioData = message.data;
    (window as { pulseSynthAudioData?: AudioBands }).pulseSynthAudioData = currentAudioData;

    // Phase 4 verification: log to console (throttled to reduce spam)
    console.log(
      `[PulseSynth:Content] Bass: ${currentAudioData.bass.toFixed(3)} | Mids: ${currentAudioData.mids.toFixed(
        3
      )} | Highs: ${currentAudioData.highs.toFixed(3)} | Energy: ${currentAudioData.energy.toFixed(3)}`
    );
  }
  return false;
});

console.log("[PulseSynth:Content] Content script loaded and listener registered.");
