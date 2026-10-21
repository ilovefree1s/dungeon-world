// ============================================================================
//  DUNGEON WORLD  -  ambience: the world's sounds, all made in code. Wind in
//  the grass, birds by day, crickets by night, water lapping by the shore,
//  lava bubbling in the ash lands, a hum in the crystal lands, and a harder
//  wind on the snow. They follow the time of day and where you stand.
// ============================================================================
import { audioNodes, audioState } from './audio.js';

let AC = null, out = null, wind = null, windF = null, windGain = null, noiseBuf = null;
let birdT = 1, cricketT = 0.5, lavaT = 0.3, humOsc = null, humGain = null, waterGain = null, waterF = null;
const state = { day: 1, biome: 0, nearWater: false, level: 1 };
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function start() {
  const n = audioNodes(); if (!n) return false;
  AC = n.AC;
  out = AC.createGain(); out.gain.value = 0; out.connect(n.master);
  // the wind: filtered noise, swelling and fading
  wind = AC.createBufferSource(); wind.buffer = noise(); wind.loop = true;
  windF = AC.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 420; windF.Q.value = 0.7;
  windGain = AC.createGain(); windGain.gain.value = 0.05;
  wind.connect(windF); windF.connect(windGain); windGain.connect(out); wind.start();
  // water lapping: bandpassed noise, pulsing slowly
  const w2 = AC.createBufferSource(); w2.buffer = noise(); w2.loop = true;
  waterF = AC.createBiquadFilter(); waterF.type = 'bandpass'; waterF.frequency.value = 900; waterF.Q.value = 1.2;
  waterGain = AC.createGain(); waterGain.gain.value = 0;
  w2.connect(waterF); waterF.connect(waterGain); waterGain.connect(out); w2.start();
  // the crystal lands' hum
  humOsc = AC.createOscillator(); humOsc.type = 'sine'; humOsc.frequency.value = 220;
  const h2 = AC.createOscillator(); h2.type = 'sine'; h2.frequency.value = 330.5;
  humGain = AC.createGain(); humGain.gain.value = 0;
  humOsc.connect(humGain); h2.connect(humGain); humGain.connect(out); humOsc.start(); h2.start();
  return true;
}
function chirp(t0) {
  // a bird: two or three quick upward whistles
  const n = 2 + Math.floor(Math.random() * 2), f0 = 2200 + Math.random() * 1400;
  for (let i = 0; i < n; i++) {
    const o = AC.createOscillator(), g = AC.createGain(), t = t0 + i * 0.13;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.07); o.frequency.exponentialRampToValueAtTime(f0 * 1.1, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.14);
  }
}
function cricket(t0) {
  // a cricket: a high tone pulsing fast, a short burst
  const o = AC.createOscillator(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
  o.type = 'triangle'; o.frequency.value = 4200 + Math.random() * 600;
  lfo.frequency.value = 28 + Math.random() * 8; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);
  g.gain.setValueAtTime(0.03, t0); g.gain.setValueAtTime(0.0001, t0 + 0.6 + Math.random() * 0.5);
  o.connect(g); g.connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + 1.2); lfo.stop(t0 + 1.2);
}
function bubble(t0) {
  // lava: a low pop with a little gurgle
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(90 + Math.random() * 60, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.25);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.35);
}
let started = false;
// once a frame: day (0..1), the biome (0 forest .. 5 crystal), whether water is near, the hero's speed
export function updateAmbience(dt, day, biome, nearWater, speed, playing) {
  if (!started) { if (!start()) return; started = true; }
  if (!AC || AC.state !== 'running') return;
  const vol = audioState.sfx * (playing ? 0.9 : 0.35);
  out.gain.setTargetAtTime(vol, AC.currentTime, 0.5);
  const t = AC.currentTime, now = performance.now() / 1000;
  // the wind: stronger on the peaks and the dunes, higher-pitched in the grass, swelling slowly
  const base = biome === 1 ? 0.16 : biome === 2 ? 0.1 : biome === 4 ? 0.07 : 0.05;
  const swell = 0.6 + 0.4 * Math.sin(now * 0.37) * Math.sin(now * 0.11 + 1);
  windGain.gain.setTargetAtTime(base * swell * (1 + speed * 0.02), t, 0.3);
  windF.frequency.setTargetAtTime(biome === 1 ? 300 : 500 + 200 * swell, t, 0.3);
  waterGain.gain.setTargetAtTime(nearWater ? 0.05 + 0.03 * Math.sin(now * 1.3) : 0, t, 0.6);
  humGain.gain.setTargetAtTime(biome === 5 ? 0.02 + 0.01 * Math.sin(now * 0.5) : 0, t, 0.8);
  // birds in the woods and the bog by day; crickets by night; bubbles in the ash lands
  birdT -= dt; cricketT -= dt; lavaT -= dt;
  if (birdT <= 0) { birdT = 1.5 + Math.random() * 4; if (day > 0.5 && (biome === 0 || biome === 3)) chirp(t + 0.05); }
  if (cricketT <= 0) { cricketT = 0.8 + Math.random() * 2; if (day < 0.4 && biome !== 1 && biome !== 4) cricket(t + 0.05); }
  if (lavaT <= 0) { lavaT = 0.4 + Math.random() * 1.6; if (biome === 4) bubble(t + 0.02); }
}
