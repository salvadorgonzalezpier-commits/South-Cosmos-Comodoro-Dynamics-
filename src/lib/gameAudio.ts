class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    gainPeak: number,
    delaySec = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      now + durationSec
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  playScanPulse() {
    this.playTone(420, 880, 0.14, 'sine', 0.08);
    this.playTone(660, 1180, 0.12, 'triangle', 0.05, 0.04);
  }

  playSampleCollect() {
    this.playTone(523.25, 659.25, 0.11, 'triangle', 0.11, 0);
    this.playTone(659.25, 1046.5, 0.16, 'sine', 0.12, 0.08);
  }

  playRelayUplink() {
    this.playTone(392.0, 587.33, 0.14, 'triangle', 0.12, 0);
    this.playTone(587.33, 783.99, 0.16, 'triangle', 0.12, 0.09);
    this.playTone(783.99, 1174.66, 0.24, 'sine', 0.14, 0.18);
  }

  playImpact() {
    this.playTone(150, 48, 0.22, 'sawtooth', 0.16, 0);
    this.playTone(95, 40, 0.24, 'square', 0.08, 0.02);
  }

  playWarning() {
    this.playTone(340, 290, 0.09, 'triangle', 0.05, 0);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, f * 1.01, 0.2, 'triangle', 0.1, idx * 0.09);
    });
  }

  playGameOver() {
    this.playTone(320, 220, 0.18, 'sawtooth', 0.1, 0);
    this.playTone(220, 110, 0.34, 'sawtooth', 0.1, 0.16);
  }
}

export const gameAudio = new GameAudioEngine();
