
class SoundManager {
  private ctx: AudioContext | null = null;
  private isPlayingTheme: boolean = false;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;
  private beatCount: number = 0;
  private tempo: number = 110;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number, startTime?: number) {
    this.init();
    if (!this.ctx) return;

    const t = startTime || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    // Envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  playClick() {
    this.playTone(1200, 'sine', 0.05, 0.05);
  }

  playDeploy() {
    this.playTone(440, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(880, 'sine', 0.1, 0.1), 50);
  }

  playAttack() {
    this.playTone(150, 'square', 0.05, 0.05);
  }

  playBaseHit() {
    this.playTone(60, 'sawtooth', 0.3, 0.15);
  }

  playUpgrade() {
    this.playTone(523.25, 'triangle', 0.2, 0.1);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.1), 100);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.3, 0.1), 200);
  }

  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.5, 0.1), i * 150);
    });
  }

  playLoss() {
    this.playTone(100, 'sawtooth', 1, 0.2);
  }

  // --- Background Music Scheduler ---

  startBattleTheme() {
    if (this.isPlayingTheme) return;
    this.init();
    this.isPlayingTheme = true;
    this.beatCount = 0;
    // Start slightly in the future to allow setup
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  stopBattleTheme() {
    this.isPlayingTheme = false;
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private scheduler() {
    if (!this.isPlayingTheme || !this.ctx) return;

    // While there are notes that will need to play before the next interval, schedule them
    // schedule ahead time of 0.1s
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleNote(this.beatCount, this.nextNoteTime);
      this.nextNoteTime += (60.0 / this.tempo) / 4; // 16th notes
      this.beatCount++;
    }

    this.timerID = window.setTimeout(this.scheduler.bind(this), 25);
  }

  private scheduleNote(beatNumber: number, time: number) {
    // 16 step loop
    const step = beatNumber % 16;

    // Bassline (Driving 8th notes): C2, C2, Eb2, F2
    // C2 = 65.41, Eb2 = 77.78, F2 = 87.31, G2 = 98.00
    if (step === 0 || step === 2) this.playTone(65.41, 'sawtooth', 0.15, 0.15, time);
    if (step === 4 || step === 6) this.playTone(65.41, 'sawtooth', 0.15, 0.15, time);
    if (step === 8 || step === 10) this.playTone(77.78, 'sawtooth', 0.15, 0.15, time);
    if (step === 12) this.playTone(87.31, 'sawtooth', 0.15, 0.15, time);
    if (step === 14) this.playTone(98.00, 'sawtooth', 0.15, 0.15, time);

    // Hi-hats / Percussion (Noise simulation via high pitch short square)
    if (step % 2 === 0) {
      // closed hat
      this.playTone(8000 + Math.random() * 1000, 'square', 0.01, 0.02, time);
    } 
    if (step === 4 || step === 12) {
      // Snare-ish
      this.playTone(200, 'square', 0.05, 0.1, time);
      this.playTone(150, 'sawtooth', 0.1, 0.1, time);
    }

    // Melody (Arpeggiator)
    // Cm7: C, Eb, G, Bb
    const melodyVol = 0.08;
    if (step === 0) this.playTone(523.25, 'sine', 0.1, melodyVol, time); // C5
    if (step === 3) this.playTone(311.13, 'sine', 0.1, melodyVol, time); // Eb4
    if (step === 6) this.playTone(392.00, 'sine', 0.1, melodyVol, time); // G4
    if (step === 9) this.playTone(466.16, 'sine', 0.1, melodyVol, time); // Bb4
    if (step === 12) this.playTone(523.25, 'sine', 0.1, melodyVol, time); // C5
    if (step === 15) this.playTone(392.00, 'sine', 0.1, melodyVol, time); // G4
  }
}

export const sounds = new SoundManager();
