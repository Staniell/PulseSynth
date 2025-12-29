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

// Start capturing audio from a tab
async function startCapture(tabId: number): Promise<{ success: boolean; error?: string }> {
  // Check if already capturing
  if (isCapturing) {
    console.log("[PulseSynth] Already capturing, stopping first...");
    await stopCapture();
  }

  try {
    // Ensure offscreen document exists
    await setupOffscreenDocument();

    // Focus the tab and its window (required for tabCapture)
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });

    // Small delay to ensure tab is focused
    await new Promise((resolve) => setTimeout(resolve, 100));

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

    case "UPDATE_SETTINGS":
      // Broadcast settings to all tabs
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: "UPDATE_SETTINGS",
                settings: message.settings,
              })
              .catch(() => {});
          }
        }
      });
      return false;

    case "AUDIO_DATA":
      // Broadcast audio data to ALL tabs for cross-tab visual persistence
      if (isCapturing) {
        chrome.tabs.query({}, (tabs) => {
          for (const tab of tabs) {
            if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
              chrome.tabs
                .sendMessage(tab.id, {
                  type: "AUDIO_DATA",
                  data: message.data,
                })
                .catch(() => {
                  // Tab may not have content script loaded
                });
            }
          }
        });
      }
      return false;

    case "START_CAPTURE":
      // Prevent multiple simultaneous start attempts
      if (isCapturing) {
        console.log("[PulseSynth] Already capturing, ignoring duplicate start request.");
        sendResponse({ success: true, tabId: capturedTabId });
        return false;
      }

      // Use provided tabId or get current active tab
      if (message.tabId) {
        startCapture(message.tabId).then((result) => {
          sendResponse({ ...result, tabId: message.tabId });
        });
      } else {
        // Get the current active tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs[0];
          if (!tab?.id) {
            sendResponse({ success: false, error: "No active tab found" });
            return;
          }
          const result = await startCapture(tab.id);
          sendResponse({ ...result, tabId: tab.id });
        });
      }
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
