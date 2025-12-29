# PulseSynth 🎵✨

An audio-reactive ambient glow Chrome extension that creates immersive visual effects based on the audio playing in your browser.

![PulseSynth Demo](demo.gif)

## Features

- 🎧 **Tab Audio Capture** — Capture audio from any browser tab
- 🌈 **Audio-Reactive Glow** — Dynamic edge glow that pulses with the music
- 🎨 **Color Mapping** — Bass creates warm colors, highs create cool colors
- 🖥️ **Cross-Tab Visuals** — Glow appears on ALL tabs while playing
- ⚙️ **Customizable** — Adjust intensity and glow width
- 💾 **Persistent Settings** — Your preferences are saved

## Installation

### From Source (Development)

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/PulseSynth.git
   cd PulseSynth
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Usage

1. **Play audio** on any website (YouTube, Spotify Web, etc.)
2. Click the **PulseSynth icon** in your browser toolbar
3. Select the **audio source tab** from the dropdown (tabs with 🔊 are playing audio)
4. Click **Start PulseSynth**
5. Enjoy the ambient glow across all your tabs!

### Controls

- **Audio Source** — Select which tab to capture audio from
- **Intensity** — Adjust overall glow brightness (0-100%)
- **Glow Width** — Adjust how far the glow extends from edges (0-100%)

## How It Works

PulseSynth uses the Chrome `tabCapture` API to capture audio from browser tabs and processes it through the Web Audio API. The audio is analyzed into frequency bands (bass, mids, highs) which drive shader uniforms for the WebGL overlay.

### Architecture

```
Tab Audio → tabCapture → Offscreen Document → Audio Analysis → Background Script → Content Scripts → WebGL Overlay
```

## Tech Stack

- **TypeScript** — Type-safe development
- **Vite** — Fast build tooling
- **Three.js** — WebGL rendering
- **Chrome Extension APIs** — tabCapture, offscreen, storage

## Permissions

- `tabCapture` — Capture audio from tabs
- `offscreen` — Audio processing in background
- `activeTab` — Access current tab
- `scripting` — Inject content scripts
- `storage` — Save user preferences
- `tabs` — Query open tabs

## Development

```bash
# Watch mode (rebuild on changes)
npm run dev

# Production build
npm run build

# Type checking
npm run tsc
```

## License

All Rights Reserved © 2025

---

Made with ❤️ for music lovers
