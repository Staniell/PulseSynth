// PulseSynth Offscreen Document Script

console.log("PulseSynth offscreen document loaded.");

// Message listener placeholder
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Offscreen received message:", message);
  sendResponse({ status: "ok" });
});
