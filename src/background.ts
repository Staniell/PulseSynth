// PulseSynth Background Service Worker

// Constants
const OFFSCREEN_DOCUMENT_PATH = "src/offscreen.html";

// Create offscreen document if it doesn't exist
async function setupOffscreenDocument(path: string) {
  // Check if offscreen document already exists
  if (await chrome.offscreen.hasDocument()) {
    console.log("Offscreen document already exists.");
    return;
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: path,
    // legitimate reasons: AUDIO_PLAYBACK, BLOBS, CLIPBOARD, DISPLAY_MEDIA, DOM_PARSER, DOM_SCRAPING,
    // IFRAME_SCRIPTING, TESTING, USER_MEDIA, WEB_RTC
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "To capture audio stream and process it with Web Audio API",
  });
  console.log("Offscreen document created.");
}

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
});

chrome.runtime.onStartup.addListener(async () => {
  await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
});
