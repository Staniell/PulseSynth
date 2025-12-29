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

// Fragment shader - edge glow effect
const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;
  uniform float uEnergy;
  uniform vec2 uResolution;

  void main() {
    // Calculate distance from edges (0 at edges, 1 at center)
    vec2 uv = vUv;
    float edgeDistX = min(uv.x, 1.0 - uv.x) * 2.0;
    float edgeDistY = min(uv.y, 1.0 - uv.y) * 2.0;
    float edgeDist = min(edgeDistX, edgeDistY);
    
    // Create smooth edge falloff
    float glowWidth = 0.15; // How far glow extends from edge
    float glow = 1.0 - smoothstep(0.0, glowWidth, edgeDist);
    
    // Static color (will be audio-reactive in Phase 6)
    vec3 glowColor = vec3(0.4, 0.2, 0.8); // Purple glow
    
    // Apply glow with transparency
    float alpha = glow * 0.6; // Max 60% opacity at edges
    
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
