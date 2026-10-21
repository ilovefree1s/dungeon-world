// ============================================================================
//  DUNGEON HEART  -  audio: every sound effect made in code (Web Audio), and
//  the music (the owner's song, music/dungeon_echoes.mp3).
// ============================================================================
let AC = null, master = null, sfxGain = null, NB = null;
export const audioState = { sfx: 0.8, music: 0.45, started: false };
const music = new Audio('music/dungeon_echoes.mp3');
music.loop = true;
music.preload = 'auto';
export function startAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 1; master.connect(AC.destination);
      sfxGain = AC.createGain(); sfxGain.gain.value = audioState.sfx * 0.6; sfxGain.connect(master);
      // a little room reverb for everything
      const conv = AC.createConvolver(), len = AC.sampleRate * 1.2, buf = AC.createBuffer(2, len, AC.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      conv.buffer = buf;
      const wet = AC.createGain(); wet.gain.value = 0.18; sfxGain.connect(conv); conv.connect(wet); wet.connect(master);
    } catch (e) { AC = null; }
  } else if (AC.state === 'suspended') AC.resume();
  if (!audioState.started) { audioState.started = true; setMusic(audioState.music); }
}
export function setMusic(v) {
  audioState.music = v;
  music.volume = Math.max(0, Math.min(1, v * 0.6));
  if (v > 0 && audioState.started) music.play().catch(() => { });
  else music.pause();
}
// (the world's ambience plugs in here)
export const audioNodes = () => AC ? { AC, master } : null;
export function setSfx(v) { audioState.sfx = v; if (sfxGain) sfxGain.gain.value = v * 0.6; }
function noiseBuf() { const b = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0, attack = 0.008) {
  if (!AC || !audioState.sfx) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, f0, f1, vol = 0.3, q = 1.5, type = 'bandpass', delay = 0) {
  if (!AC || !audioState.sfx) return;
  NB ||= noiseBuf();
  const t = AC.currentTime + delay, n = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  n.buffer = NB; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
}
const last = {};
const SFX = {
  swing: () => noise(0.17, 700, 3400, 0.4, 2.2),
  cast: () => { tone(420, 1200, 0.22, 'sine', 0.18); tone(630, 1800, 0.18, 'triangle', 0.1, 0.03); noise(0.2, 2000, 5000, 0.12, 4); },
  shoot: () => { tone(900, 300, 0.09, 'triangle', 0.18); noise(0.12, 3000, 1500, 0.2, 3); },
  blink: () => { tone(300, 1600, 0.25, 'sine', 0.2); tone(1600, 400, 0.25, 'sine', 0.12, 0.1); },
  hit: () => { tone(200, 70, 0.14, 'triangle', 0.38); noise(0.1, 900, 300, 0.32, 1, 'lowpass'); },
  crit: () => { tone(320, 80, 0.2, 'square', 0.22); noise(0.16, 2400, 600, 0.36, 1.5); tone(1400, 1400, 0.06, 'square', 0.08, 0.02); },
  kill: () => { tone(300, 60, 0.3, 'sine', 0.4); noise(0.24, 1300, 300, 0.25, 2.5); },
  hurt: () => { tone(170, 60, 0.26, 'sawtooth', 0.22); noise(0.15, 600, 200, 0.2, 1, 'lowpass'); },
  pickup: () => { tone(880, 1320, 0.1, 'triangle', 0.16); tone(1320, 1760, 0.12, 'triangle', 0.12, 0.06); },
  coin: () => { tone(1320, 1320, 0.07, 'square', 0.07); tone(1980, 1980, 0.14, 'square', 0.06, 0.06); },
  rare: () => [660, 880, 1320].forEach((f, i) => tone(f, f * 1.01, 0.25, 'triangle', 0.14, i * 0.06)),
  legend: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.005, 0.4, 'triangle', 0.14, i * 0.07)); noise(0.8, 4000, 8000, 0.06, 6, 'bandpass', 0.2); },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.24, 'triangle', 0.2, i * 0.09)),
  door: () => { noise(0.9, 220, 80, 0.35, 0.8, 'lowpass'); tone(90, 55, 0.8, 'sawtooth', 0.07); },
  roll: () => noise(0.24, 400, 1200, 0.22, 1.2),
  roar: () => { tone(110, 60, 0.7, 'sawtooth', 0.2); noise(0.7, 500, 150, 0.3, 1, 'lowpass'); tone(150, 80, 0.6, 'square', 0.06, 0.05); },
  slam: () => { tone(90, 35, 0.5, 'sine', 0.55); noise(0.4, 400, 60, 0.45, 0.7, 'lowpass'); },
  buy: () => { tone(1046, 1046, 0.08, 'square', 0.06); tone(1568, 1568, 0.16, 'square', 0.06, 0.07); noise(0.1, 6000, 4000, 0.05, 3, 'bandpass', 0.05); },
  nope: () => { tone(220, 180, 0.12, 'square', 0.08); tone(180, 150, 0.14, 'square', 0.08, 0.1); },
  block: () => { tone(1200, 900, 0.1, 'triangle', 0.18); noise(0.15, 5000, 2000, 0.2, 5); },
  drink: () => { for (let i = 0; i < 4; i++) tone(300 + i * 60, 500 + i * 60, 0.07, 'sine', 0.15, i * 0.09); },
  bite: () => { noise(0.08, 1200, 400, 0.25, 2); tone(260, 120, 0.08, 'square', 0.08); },
  death: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.4, 'triangle', 0.18, i * 0.2)),
};
export function sfx(name) {
  if (!AC || !SFX[name]) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 40) return; // (no stacking the same sound in one frame)
  last[name] = now;
  SFX[name]();
}
