// PulseSynth Background Service Worker

// Constants
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

// State
let isCapturing = false;
let capturedTabId: number | null = null;

// Create offscreen document if it doesn't exist
async function setupOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    console.log("[PulseSynth] Offscreen document already exists.");
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Capture and analyze audio stream from tab",
  });
  console.log("[PulseSynth] Offscreen document created.");
}

// Start capturing audio from the current tab
async function startCapture(tabId: number): Promise<{ success: boolean; error?: string }> {
  // Check if already capturing
  if (isCapturing) {
    console.log("[PulseSynth] Already capturing, stopping first...");
    await stopCapture();
  }

  try {
    // Ensure offscreen document exists
    await setupOffscreenDocument();

    // Get media stream ID for the tab
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    console.log("[PulseSynth] Got stream ID:", streamId);

    // Send stream ID to offscreen document
    const response = await chrome.runtime.sendMessage({
      type: "START_AUDIO_STREAM",
      target: "offscreen",
      streamId: streamId,
    });

    if (response?.success) {
      isCapturing = true;
      capturedTabId = tabId;
      console.log("[PulseSynth] Audio capture started for tab:", tabId);
      return { success: true };
    } else {
      return { success: false, error: response?.error || "Unknown error" };
    }
  } catch (error) {
    console.error("[PulseSynth] Failed to start capture:", error);
    // Reset state on error
    isCapturing = false;
    capturedTabId = null;
    return { success: false, error: String(error) };
  }
}

// Stop capturing audio
async function stopCapture(): Promise<{ success: boolean }> {
  if (!isCapturing) {
    console.log("[PulseSynth] Not capturing, nothing to stop.");
    return { success: true };
  }

  try {
    // Tell offscreen document to stop
    await chrome.runtime.sendMessage({
      type: "STOP_AUDIO_STREAM",
      target: "offscreen",
    });

    isCapturing = false;
    capturedTabId = null;
    console.log("[PulseSynth] Audio capture stopped.");

    return { success: true };
  } catch (error) {
    console.error("[PulseSynth] Failed to stop capture:", error);
    // Force reset state even on error
    isCapturing = false;
    capturedTabId = null;
    return { success: false };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Ignore messages meant for offscreen
  if (message.target === "offscreen") {
    return false;
  }

  switch (message.type) {
    case "GET_STATUS":
      sendResponse({ isActive: isCapturing, tabId: capturedTabId });
      return false;

    case "AUDIO_DATA":
      // Route audio data to the captured tab's content script
      console.log("[PulseSynth] Received AUDIO_DATA, isCapturing:", isCapturing, "capturedTabId:", capturedTabId);
      if (isCapturing && capturedTabId) {
        chrome.tabs
          .sendMessage(capturedTabId, {
            type: "AUDIO_DATA",
            data: message.data,
          })
          .then(() => {
            // Message sent successfully
          })
          .catch((err) => {
            console.error("[PulseSynth] Failed to send to content script:", err);
          });
      }
      return false;

    case "START_CAPTURE":
      // Prevent multiple simultaneous start attempts
      if (isCapturing) {
        console.log("[PulseSynth] Already capturing, ignoring duplicate start request.");
        sendResponse({ success: true }); // UI already shows active
        return false;
      }

      // Get the current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }
        const result = await startCapture(tab.id);
        sendResponse(result);
      });
      return true; // Will respond asynchronously

    case "STOP_CAPTURE":
      stopCapture().then(sendResponse);
      return true; // Will respond asynchronously

    default:
      return false;
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[PulseSynth] Extension installed.");
});
