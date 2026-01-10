// Sound effects - Web Audio API for clicks (low latency), HTML5 Audio for startup

let audioContext = null;
let clickBuffer = null;
let startupAudio = null;
let isInitialized = false;

// Get or create audio context (lazy initialization)
const getAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Failed to create audio context:', e);
      return null;
    }
  }
  return audioContext;
};

// Load click sound into Web Audio buffer for low-latency playback
const loadClickBuffer = async () => {
  if (clickBuffer) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const response = await fetch('/sound/mouse-click.mp3');
    const arrayBuffer = await response.arrayBuffer();
    clickBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn('Failed to load click sound:', e);
  }
};

// Preload startup sound
const preloadStartup = () => {
  if (!startupAudio) {
    try {
      startupAudio = new Audio('/sound/startup.mp3');
      startupAudio.preload = 'auto';
      startupAudio.load();
    } catch (e) {
      console.warn('Failed to preload startup sound:', e);
    }
  }
};

// Initialize sounds (called lazily on first use)
const ensureInitialized = async () => {
  if (isInitialized) return;
  isInitialized = true;
  preloadStartup();
  await loadClickBuffer();
};

// Resume audio context (required for iOS after user gesture)
export const resumeAudio = async () => {
  await ensureInitialized();
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch (e) {
    // Ignore errors
  }
};

// Play click sound using Web Audio API (low latency)
export const playClick = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended' || !clickBuffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = clickBuffer;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    gainNode.gain.value = 1;

    source.start(0);
  } catch (e) {
    // Ignore audio errors
  }
};

// Play success sound (uses click for now)
export const playSuccess = () => {
  playClick();
};

// Play startup sound
export const playStartupSound = () => {
  try {
    preloadStartup();
    if (startupAudio) {
      startupAudio.currentTime = 0;
      startupAudio.volume = 1;
      startupAudio.play().catch(() => {});
    }
  } catch (e) {
    // Ignore audio errors
  }
};

// Fade out the startup sound
export const fadeOutStartupSound = (duration = 800) => {
  try {
    if (startupAudio) {
      const startVolume = startupAudio.volume;
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = startVolume / steps;

      let currentStep = 0;
      const fadeInterval = setInterval(() => {
        currentStep++;
        startupAudio.volume = Math.max(0, startVolume - (volumeStep * currentStep));
        if (currentStep >= steps) {
          clearInterval(fadeInterval);
          startupAudio.pause();
          startupAudio.volume = 1;
          startupAudio.currentTime = 0;
        }
      }, stepDuration);
    }
  } catch (e) {
    // Ignore audio errors
  }
};

// Stop all sounds
export const stopAllSounds = () => {
  try {
    if (startupAudio) {
      startupAudio.pause();
      startupAudio.currentTime = 0;
    }
  } catch (e) {
    // Ignore audio errors
  }
};
