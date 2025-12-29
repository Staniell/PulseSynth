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

// Vertex shader - simple fullscreen quad
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - audio-reactive edge glow
const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;
  uniform float uEnergy;
  uniform vec2 uResolution;

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
    
    // Dynamic glow width based on energy (0.1 to 0.25)
    float baseGlowWidth = 0.1;
    float glowWidth = baseGlowWidth + uEnergy * 0.15;
    
    // Create smooth edge falloff with bass pulse
    float bassPulse = 1.0 + uBass * 0.3; // Bass makes glow wider
    float glow = 1.0 - smoothstep(0.0, glowWidth * bassPulse, edgeDist);
    
    // Audio-reactive color
    // Bass = warm (red/orange), Mids = neutral (purple), Highs = cool (cyan/blue)
    float hue = 0.75 - uBass * 0.25 + uHighs * 0.15; // Shift hue based on audio
    hue = mod(hue + uTime * 0.02, 1.0); // Slow rotation over time
    
    float saturation = 0.7 + uMids * 0.3; // More saturated with mids
    float brightness = 0.8 + uEnergy * 0.2; // Brighter with energy
    
    vec3 glowColor = hsv2rgb(vec3(hue, saturation, brightness));
    
    // Add subtle breathing animation
    float breathe = sin(uTime * 2.0) * 0.1 + 0.9;
    
    // Intensity based on overall energy
    float intensity = 0.4 + uEnergy * 0.4; // 40% to 80% intensity
    
    // Final alpha with breathing and audio
    float alpha = glow * intensity * breathe;
    
    // Add slight inner glow on bass hits
    float innerGlow = smoothstep(0.3, 0.0, edgeDist) * uBass * 0.15;
    alpha += innerGlow;
    
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
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
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
