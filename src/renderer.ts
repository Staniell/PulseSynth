// PulseSynth Renderer
// Three.js WebGL overlay for audio-reactive glow

import * as THREE from "three";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let material: THREE.ShaderMaterial | null = null;
let animationId: number | null = null;

// Audio data from content script
let audioData = {
  bass: 0,
  mids: 0,
  highs: 0,
  energy: 0,
};

// Preset type definition
export type PresetName = "ambient" | "punchy" | "chill";

// Preset parameters
interface PresetParams {
  bassGain: number; // Bass intensity multiplier
  bassReach: number; // How far bass pushes glow inward
  hueSpeed: number; // Speed of hue rotation
  shimmerAmp: number; // Shimmer intensity
  shimmerSpeed: number; // Shimmer animation speed
}

// Preset definitions
export const PRESETS: Record<PresetName, PresetParams> = {
  ambient: {
    bassGain: 0.3,
    bassReach: 0.15,
    hueSpeed: 0.02,
    shimmerAmp: 0.1,
    shimmerSpeed: 2.0,
  },
  punchy: {
    bassGain: 0.6,
    bassReach: 0.35,
    hueSpeed: 0.04,
    shimmerAmp: 0.3,
    shimmerSpeed: 5.0,
  },
  chill: {
    bassGain: 0.2,
    bassReach: 0.1,
    hueSpeed: 0.01,
    shimmerAmp: 0.05,
    shimmerSpeed: 1.0,
  },
};

// Settings from popup
let settings = {
  intensity: 100,
  glowWidth: 100,
  preset: "ambient" as PresetName,
};

// Vertex shader - simple fullscreen quad
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - audio-reactive edge glow with preset support
const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;
  uniform float uEnergy;
  uniform float uIntensity;
  uniform float uGlowWidth;
  uniform vec2 uResolution;
  
  // Preset uniforms
  uniform float uBassGain;
  uniform float uBassReach;
  uniform float uHueSpeed;
  uniform float uShimmerAmp;
  uniform float uShimmerSpeed;

  // Pseudo-random for shimmer
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // HSV to RGB conversion
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = vUv;
    
    // Calculate distance from edges (0 at edges, 1 at center)
    float edgeDistX = min(uv.x, 1.0 - uv.x) * 2.0;
    float edgeDistY = min(uv.y, 1.0 - uv.y) * 2.0;
    float edgeDist = min(edgeDistX, edgeDistY);
    
    // Dynamic glow width based on energy and user setting
    float baseGlowWidth = 0.1 * uGlowWidth;
    float glowWidth = baseGlowWidth + uEnergy * 0.15 * uGlowWidth;
    
    // Bass-driven inward reach (controlled by preset)
    float bassEffect = uBass * uBassGain;
    float bassReach = bassEffect * uBassReach;
    float bassPulse = 1.0 + bassEffect;
    float glow = 1.0 - smoothstep(0.0, (glowWidth + bassReach) * bassPulse, edgeDist);
    
    // Audio-reactive color with preset-controlled hue speed
    float hue = 0.75 - uBass * 0.25 + uHighs * 0.15;
    hue = mod(hue + uTime * uHueSpeed, 1.0);
    
    float saturation = 0.7 + uMids * 0.3;
    float brightness = 0.8 + uEnergy * 0.2;
    
    vec3 glowColor = hsv2rgb(vec3(hue, saturation, brightness));
    
    // Shimmer effect (controlled by preset)
    vec2 shimmerCoord = uv * 15.0 + uTime * uShimmerSpeed;
    float shimmer = hash(floor(shimmerCoord));
    shimmer = (shimmer - 0.5) * uHighs * uShimmerAmp;
    float flicker = sin(uTime * (5.0 + uHighs * 10.0)) * 0.5 + 0.5;
    shimmer *= flicker * glow; // Only shimmer in glow areas
    
    // Breathing animation
    float breathe = sin(uTime * 2.0) * 0.1 + 0.9;
    
    // Intensity based on energy and user setting
    float intensity = (0.4 + uEnergy * 0.4) * uIntensity;
    
    // Final alpha with shimmer
    float alpha = glow * intensity * breathe + shimmer * uIntensity;
    
    // Inner glow on bass hits (scaled by preset bass gain)
    float innerGlow = smoothstep(0.3, 0.0, edgeDist) * bassEffect * 0.2 * uIntensity;
    alpha += innerGlow;
    
    alpha = clamp(alpha, 0.0, 0.9);
    
    gl_FragColor = vec4(glowColor, alpha);
  }
`;

export function initRenderer(): HTMLCanvasElement | null {
  // Check if already initialized
  if (renderer) {
    console.log("[PulseSynth:Renderer] Already initialized.");
    return renderer.domElement;
  }

  try {
    // Create WebGL renderer
    renderer = new THREE.WebGLRenderer({
      alpha: true, // Transparent background
      antialias: true,
      premultipliedAlpha: false,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent

    // Style canvas for overlay
    const canvas = renderer.domElement;
    canvas.id = "pulsesynth-overlay";
    canvas.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
    `;

    // Create scene
    scene = new THREE.Scene();

    // Create orthographic camera for 2D rendering
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Create shader material
    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMids: { value: 0 },
        uHighs: { value: 0 },
        uEnergy: { value: 0 },
        uIntensity: { value: 1.0 },
        uGlowWidth: { value: 1.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        // Preset uniforms (default: ambient)
        uBassGain: { value: PRESETS.ambient.bassGain },
        uBassReach: { value: PRESETS.ambient.bassReach },
        uHueSpeed: { value: PRESETS.ambient.hueSpeed },
        uShimmerAmp: { value: PRESETS.ambient.shimmerAmp },
        uShimmerSpeed: { value: PRESETS.ambient.shimmerSpeed },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Handle window resize
    window.addEventListener("resize", onWindowResize);

    console.log("[PulseSynth:Renderer] Initialized successfully.");
    return canvas;
  } catch (error) {
    console.error("[PulseSynth:Renderer] Failed to initialize:", error);
    return null;
  }
}

function onWindowResize() {
  if (!renderer || !material) return;

  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}

export function startRenderLoop() {
  if (animationId !== null) return;

  const startTime = performance.now();

  function render() {
    if (!renderer || !scene || !camera || !material) {
      animationId = null;
      return;
    }

    // Update time uniform
    material.uniforms.uTime.value = (performance.now() - startTime) / 1000;

    // Update audio uniforms (will be used in Phase 6)
    material.uniforms.uBass.value = audioData.bass;
    material.uniforms.uMids.value = audioData.mids;
    material.uniforms.uHighs.value = audioData.highs;
    material.uniforms.uEnergy.value = audioData.energy;

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(render);
  }

  animationId = requestAnimationFrame(render);
  console.log("[PulseSynth:Renderer] Render loop started.");
}

export function stopRenderLoop() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
    console.log("[PulseSynth:Renderer] Render loop stopped.");
  }
}

export function updateAudioData(data: { bass: number; mids: number; highs: number; energy: number }) {
  audioData = data;
}

// Apply a preset to the shader
export function setPreset(presetName: PresetName) {
  const preset = PRESETS[presetName];

  if (material) {
    material.uniforms.uBassGain.value = preset.bassGain;
    material.uniforms.uBassReach.value = preset.bassReach;
    material.uniforms.uHueSpeed.value = preset.hueSpeed;
    material.uniforms.uShimmerAmp.value = preset.shimmerAmp;
    material.uniforms.uShimmerSpeed.value = preset.shimmerSpeed;
  }
}

export function updateSettings(newSettings: { intensity: number; glowWidth: number; preset?: PresetName }) {
  settings = { ...settings, ...newSettings };
  if (material) {
    material.uniforms.uIntensity.value = settings.intensity / 100;
    material.uniforms.uGlowWidth.value = settings.glowWidth / 100;
  }
  if (newSettings.preset) {
    setPreset(newSettings.preset);
  }
}

export function destroyRenderer() {
  stopRenderLoop();

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = null;
  }

  if (material) {
    material.dispose();
    material = null;
  }

  scene = null;
  camera = null;

  window.removeEventListener("resize", onWindowResize);
  console.log("[PulseSynth:Renderer] Destroyed.");
}
