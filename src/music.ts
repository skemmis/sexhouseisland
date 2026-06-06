// ============================================================================
//  MUSIC. A tiny generative chiptune — no audio files, just Web Audio
//  oscillators. A slow melancholy minor loop (pad + bass + arp) to sit under
//  the dusk. Starts on the first user gesture (autoplay policy); 'm' toggles.
// ============================================================================
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let muted = false;
let step = 0;
let nextTime = 0;

const BPM = 74;
const stepDur = 60 / BPM / 2; // eighth notes
// i – VI – III – VII in A minor: Am, F, C, G — wistful, loops forever.
const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const bass = [33, 29, 36, 31]; // low roots
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

function blip(time: number, midi: number, dur: number, type: OscillatorType, gain: number, detune = 0) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = mtof(midi);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g).connect(master);
  o.start(time);
  o.stop(time + dur + 0.05);
}

function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % chords.length;
    const ch = chords[bar];
    const s = step % 8;
    if (s === 0 || s === 4) blip(nextTime, bass[bar], stepDur * 1.9, "triangle", 0.22); // bass
    if (s === 0) ch.forEach((n) => blip(nextTime, n, stepDur * 7.5, "triangle", 0.05)); // pad
    const arp = ch[s % ch.length] + (s >= 4 ? 12 : 0); // arp climbs in the 2nd half
    blip(nextTime, arp, stepDur * 0.85, "square", 0.045, 4);
    if (s === 6) blip(nextTime, ch[2] + 12, stepDur * 1.5, "square", 0.03, -4); // sparkle
    nextTime += stepDur;
    step++;
  }
}

export function startMusic() {
  if (ctx) return; // already running
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  const lp = ctx.createBiquadFilter(); // warm it up
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  master.connect(lp).connect(ctx.destination);
  nextTime = ctx.currentTime + 0.1;
  if (timer) clearInterval(timer);
  timer = window.setInterval(schedule, 60);
}

export function toggleMusic(): boolean {
  muted = !muted;
  if (master && ctx) master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, ctx.currentTime + 0.1);
  return muted;
}

export const musicMuted = () => muted;
