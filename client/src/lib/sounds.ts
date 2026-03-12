let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function playCorrect() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

export function playWrong() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.35);
}

/** Neutral "miss" — short descending tone, softer than wrong */
export function playNeutral() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playTick() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

export function playGameEnd() {
  const ctx = getCtx();
  const notes = [523, 440, 349, 262];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.3);
  });
}

// --- Helper layers ---

function playBassThump(intensity: number = 1) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(80 + intensity * 20, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.12 * intensity, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

function playShimmer(baseFreq: number = 2200) {
  const ctx = getCtx();
  // Two slightly detuned oscillators for width
  [0, 7].forEach((detune) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);
    osc.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  });
}

function playChord(notes: number[], vol: number = 0.12, duration: number = 0.35) {
  const ctx = getCtx();
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
    gain.gain.setValueAtTime(vol, ctx.currentTime + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + duration);
    osc.start(ctx.currentTime + i * 0.06);
    osc.stop(ctx.currentTime + i * 0.06 + duration);
  });
}

// --- Target Man: unified score sound ---

/**
 * Play a sound that scales with the result quality.
 * finalPoints drives the intensity — more points = more layers.
 * isExact / isBoostHit add specific flavors on top.
 */
export function playScoreSound(opts: {
  finalPoints: number;
  basePoints: number;
  isExact: boolean;
  isBoostHit: boolean;
  comboStreak: number;
}) {
  const { finalPoints, basePoints, isExact, isBoostHit, comboStreak } = opts;

  if (isExact) {
    // Triumphant rising chord + bass drop + shimmer
    playChord([880, 1100, 1320, 1760], 0.14, 0.45);
    playBassThump(1.5);
    playShimmer(2400);
    return;
  }

  if (finalPoints >= 60) {
    // Massive score — full chord + bass + shimmer
    const pitch = 880 + Math.min(comboStreak, 5) * 80;
    playChord([pitch, pitch * 1.25, pitch * 1.5], 0.13, 0.35);
    playBassThump(1.2);
    playShimmer();
    return;
  }

  if (finalPoints >= 30) {
    // Big score — ascending tone + bass thump
    const pitch = 880 + Math.min(comboStreak, 5) * 80;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.setValueAtTime(pitch * 1.25, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    playBassThump(0.8);
    if (isBoostHit) playShimmer(2000);
    return;
  }

  if (finalPoints >= 14) {
    // Decent score — standard correct with slight pitch variation
    const pitch = 880 + Math.min(comboStreak, 3) * 60;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.setValueAtTime(pitch * 1.2, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
    if (isBoostHit) playShimmer(1800);
    return;
  }

  // Low score — muted, short
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  osc.frequency.setValueAtTime(730, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

// --- Legacy individual sounds (used by other games) ---

/** Ascending correct sound — pitch rises with combo streak */
export function playComboCorrect(streak: number) {
  const ctx = getCtx();
  const basePitch = 880 + Math.min(streak, 5) * 110;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(basePitch, ctx.currentTime);
  osc.frequency.setValueAtTime(basePitch * 1.25, ctx.currentTime + 0.08);
  const vol = 0.12 + Math.min(streak, 5) * 0.02;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
  if (streak >= 3) {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(basePitch * 1.5, ctx.currentTime + 0.04);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc2.start(ctx.currentTime + 0.04);
    osc2.stop(ctx.currentTime + 0.2);
  }
}

export function playExactMatch() {
  playScoreSound({ finalPoints: 50, basePoints: 50, isExact: true, isBoostHit: false, comboStreak: 0 });
}

export function playBoostHit() {
  playShimmer(1800);
}

export function playOkCorrect() {
  playScoreSound({ finalPoints: 8, basePoints: 8, isExact: false, isBoostHit: false, comboStreak: 0 });
}

/** Shield block — bright metallic "ping" deflect, positive feel */
export function playShieldBlock() {
  const ctx = getCtx();
  // Quick rising metallic ping
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(600, ctx.currentTime);
  osc1.frequency.setValueAtTime(1200, ctx.currentTime + 0.06);
  osc1.frequency.setValueAtTime(900, ctx.currentTime + 0.15);
  gain1.gain.setValueAtTime(0.14, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.3);
  // Shimmery overtone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1800, ctx.currentTime + 0.03);
  osc2.frequency.setValueAtTime(2400, ctx.currentTime + 0.1);
  gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.03);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc2.start(ctx.currentTime + 0.03);
  osc2.stop(ctx.currentTime + 0.25);
}

export function playHighScore() {
  const ctx = getCtx();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    gain.gain.setValueAtTime(0.13, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.35);
  });
}
