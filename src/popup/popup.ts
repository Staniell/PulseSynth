// PulseSynth Popup Script

const toggleBtn = document.getElementById("toggleBtn") as HTMLButtonElement;
const statusDot = document.getElementById("statusDot") as HTMLDivElement;
const statusText = document.getElementById("statusText") as HTMLSpanElement;

let isActive = false;

// Update UI based on state
function updateUI(active: boolean) {
  isActive = active;

  if (active) {
    statusDot.classList.add("active");
    statusText.classList.add("active");
    statusText.textContent = "Active";
    toggleBtn.textContent = "Stop PulseSynth";
    toggleBtn.classList.add("btn-stop");
  } else {
    statusDot.classList.remove("active");
    statusText.classList.remove("active");
    statusText.textContent = "Inactive";
    toggleBtn.textContent = "Start PulseSynth";
    toggleBtn.classList.remove("btn-stop");
  }
}

// Check initial state on popup open
chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
  if (response?.isActive) {
    updateUI(true);
  }
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
    // Start capture for current tab
    chrome.runtime.sendMessage({ type: "START_CAPTURE" }, (response) => {
      toggleBtn.disabled = false;
      if (response?.success) {
        updateUI(true);
      } else {
        console.error("Failed to start capture:", response?.error);
      }
    });
  }
});
