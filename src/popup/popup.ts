// PulseSynth Popup Script

const toggleBtn = document.getElementById("toggleBtn") as HTMLButtonElement;
const statusDot = document.getElementById("statusDot") as HTMLDivElement;
const statusText = document.getElementById("statusText") as HTMLSpanElement;
const intensitySlider = document.getElementById("intensitySlider") as HTMLInputElement;
const intensityValue = document.getElementById("intensityValue") as HTMLSpanElement;
const glowWidthSlider = document.getElementById("glowWidthSlider") as HTMLInputElement;
const glowWidthValue = document.getElementById("glowWidthValue") as HTMLSpanElement;
const tabSelect = document.getElementById("tabSelect") as HTMLSelectElement;
const presetSelect = document.getElementById("presetSelect") as HTMLSelectElement;

let isActive = false;
let selectedTabId: number | null = null;

// Preset type
type PresetName = "ambient" | "punchy" | "chill";

// Settings interface
interface Settings {
  intensity: number;
  glowWidth: number;
  preset: PresetName;
}

// Default settings
const defaultSettings: Settings = {
  intensity: 100,
  glowWidth: 100,
  preset: "ambient",
};

// Load settings from storage
async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pulseSynthSettings"], (result) => {
      const stored = result.pulseSynthSettings as Settings | undefined;
      resolve({ ...defaultSettings, ...stored });
    });
  });
}

// Save settings to storage
async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pulseSynthSettings: settings }, resolve);
  });
}

// Broadcast settings to all tabs
function broadcastSettings(settings: Settings) {
  chrome.runtime.sendMessage({
    type: "UPDATE_SETTINGS",
    settings: settings,
  });
}

// Populate tab selector with open tabs
async function populateTabs() {
  const tabs = await chrome.tabs.query({ audible: true });
  const allTabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });

  // Clear existing options except "Current Tab"
  tabSelect.innerHTML = '<option value="current">Current Tab</option>';

  // Add tabs that are playing audio first
  const addedTabIds = new Set<number>();

  for (const tab of tabs) {
    if (tab.id && tab.title && !addedTabIds.has(tab.id)) {
      const option = document.createElement("option");
      option.value = String(tab.id);
      option.textContent = `🔊 ${tab.title.substring(0, 35)}${tab.title.length > 35 ? "..." : ""}`;
      tabSelect.appendChild(option);
      addedTabIds.add(tab.id);
    }
  }

  // Add separator if there are audible tabs
  if (tabs.length > 0 && allTabs.length > tabs.length) {
    const separator = document.createElement("option");
    separator.disabled = true;
    separator.textContent = "────────────";
    tabSelect.appendChild(separator);
  }

  // Add other tabs
  for (const tab of allTabs) {
    if (tab.id && tab.title && !addedTabIds.has(tab.id)) {
      const option = document.createElement("option");
      option.value = String(tab.id);
      option.textContent = tab.title.substring(0, 40) + (tab.title.length > 40 ? "..." : "");
      tabSelect.appendChild(option);
      addedTabIds.add(tab.id);
    }
  }
}

// Update UI based on state
function updateUI(active: boolean, tabId?: number) {
  isActive = active;

  if (active) {
    statusDot.classList.add("active");
    statusText.classList.add("active");
    statusText.textContent = "Active";
    toggleBtn.textContent = "Stop PulseSynth";
    toggleBtn.classList.add("btn-stop");
    tabSelect.disabled = true;

    // Select the captured tab in dropdown
    if (tabId) {
      tabSelect.value = String(tabId);
    }
  } else {
    statusDot.classList.remove("active");
    statusText.classList.remove("active");
    statusText.textContent = "Inactive";
    toggleBtn.textContent = "Start PulseSynth";
    toggleBtn.classList.remove("btn-stop");
    tabSelect.disabled = false;
  }
}

// Initialize popup
async function init() {
  // Load saved settings
  const settings = await loadSettings();

  // Apply to UI
  intensitySlider.value = String(settings.intensity);
  intensityValue.textContent = `${settings.intensity}%`;
  glowWidthSlider.value = String(settings.glowWidth);
  glowWidthValue.textContent = `${settings.glowWidth}%`;
  presetSelect.value = settings.preset;

  // Populate tab list
  await populateTabs();

  // Check capture status
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (response?.isActive) {
      updateUI(true, response.tabId);
    }
  });
}

// Intensity slider handler
intensitySlider.addEventListener("input", async () => {
  const value = parseInt(intensitySlider.value);
  intensityValue.textContent = `${value}%`;

  const settings = await loadSettings();
  settings.intensity = value;
  await saveSettings(settings);
  broadcastSettings(settings);
});

// Glow width slider handler
glowWidthSlider.addEventListener("input", async () => {
  const value = parseInt(glowWidthSlider.value);
  glowWidthValue.textContent = `${value}%`;

  const settings = await loadSettings();
  settings.glowWidth = value;
  await saveSettings(settings);
  broadcastSettings(settings);
});

// Preset selector handler
presetSelect.addEventListener("change", async () => {
  const value = presetSelect.value as PresetName;

  const settings = await loadSettings();
  settings.preset = value;
  await saveSettings(settings);
  broadcastSettings(settings);
});

// Handle button click
toggleBtn.addEventListener("click", async () => {
  toggleBtn.disabled = true;

  if (isActive) {
    // Stop capture
    chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, (response) => {
      toggleBtn.disabled = false;
      if (response?.success) {
        updateUI(false);
      }
    });
  } else {
    // Get selected tab
    const selectedValue = tabSelect.value;
    let tabId: number | undefined;

    if (selectedValue !== "current") {
      tabId = parseInt(selectedValue);
    }

    // Start capture
    chrome.runtime.sendMessage({ type: "START_CAPTURE", tabId }, (response) => {
      toggleBtn.disabled = false;
      if (response?.success) {
        updateUI(true, response.tabId);
      } else {
        console.error("Failed to start capture:", response?.error);
      }
    });
  }
});

// Initialize on load
init();
