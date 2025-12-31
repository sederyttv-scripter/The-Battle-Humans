
class SoundManager {
  private ctx: AudioContext | null = null;
  private isPlayingTheme: boolean = false;
  private currentThemeType: 'normal' | 'boss' | 'advanced' | 'lobby' | 'electronic' | null = null;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;
  private beatCount: number = 0;
  private tempo: number = 110;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.log("Audio resume failed (waiting for interaction):", e));
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

  startBattleTheme(type: 'normal' | 'boss' | 'advanced' | 'lobby' | 'electronic' = 'normal') {
    if (this.isPlayingTheme && this.currentThemeType === type) return;
    this.stopBattleTheme(); // Reset if switching modes
    
    this.init();
    this.isPlayingTheme = true;
    this.currentThemeType = type;
    this.beatCount = 0;
    
    if (type === 'boss') this.tempo = 140;
    else if (type === 'electronic') this.tempo = 128; // Fast, Techno
    else if (type === 'advanced') this.tempo = 125;
    else if (type === 'lobby') this.tempo = 85; // Chill tempo
    else this.tempo = 110;
    
    // Start slightly in the future to allow setup
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  stopBattleTheme() {
    this.isPlayingTheme = false;
    this.currentThemeType = null;
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
      if (this.currentThemeType === 'boss') {
          this.scheduleBossNote(this.beatCount, this.nextNoteTime);
      } else if (this.currentThemeType === 'electronic') {
          this.scheduleElectronicNote(this.beatCount, this.nextNoteTime);
      } else if (this.currentThemeType === 'advanced') {
          this.scheduleAdvancedNote(this.beatCount, this.nextNoteTime);
      } else if (this.currentThemeType === 'lobby') {
          this.scheduleLobbyNote(this.beatCount, this.nextNoteTime);
      } else {
          this.scheduleNote(this.beatCount, this.nextNoteTime);
      }
      this.nextNoteTime += (60.0 / this.tempo) / 4; // 16th notes
      this.beatCount++;
    }

    this.timerID = window.setTimeout(this.scheduler.bind(this), 25);
  }

  // --- 64-STEP MUSIC ENGINES ---

  private scheduleLobbyNote(beatNumber: number, time: number) {
    const step = beatNumber % 64; 
    
    // Chill Lo-fi Progression: FMaj7 -> Em7 -> Dm7 -> CMaj7
    // Bass (Deep Sine/Triangle)
    if (step % 16 === 0) { 
        let bassFreq = 0;
        if (step < 16) bassFreq = 87.31; 
        else if (step < 32) bassFreq = 82.41; 
        else if (step < 48) bassFreq = 73.42; 
        else bassFreq = 65.41; 
        this.playTone(bassFreq, 'triangle', 0.8, 0.2, time);
    }
    // Chords (Soft Sine Arpeggios)
    if (step % 8 === 0) {
        let chord = [];
        if (step < 16) chord = [349.23, 440.00, 523.25, 659.25]; // F A C E
        else if (step < 32) chord = [329.63, 392.00, 493.88, 587.33]; // E G B D
        else if (step < 48) chord = [293.66, 349.23, 440.00, 523.25]; // D F A C
        else chord = [261.63, 329.63, 392.00, 493.88]; // C E G B
        chord.forEach((freq, i) => this.playTone(freq, 'sine', 0.3, 0.05, time + (i * 0.05)));
    }
    // Percussion
    if (step % 8 === 0) this.playTone(60, 'sine', 0.1, 0.3, time);
    if (step % 16 === 4 || step % 16 === 12) {
        this.playTone(400, 'square', 0.02, 0.03, time);
        this.playTone(800, 'triangle', 0.02, 0.03, time);
    }
    if (step % 4 === 2) this.playTone(2000, 'triangle', 0.02, 0.02, time);

    // Melody
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    if (step % 2 === 0 && Math.random() > 0.6) {
        const note = pentatonic[Math.floor(Math.random() * pentatonic.length)];
        this.playTone(note, 'sine', 0.15, 0.05, time);
    }
  }

  private scheduleElectronicNote(beatNumber: number, time: number) {
    const step = beatNumber % 32; // Faster loops
    
    // Synthwave / Cyberpunk vibe
    
    // Kick (Four on the floor)
    if (step % 4 === 0) {
        this.playTone(55, 'square', 0.1, 0.4, time);
        this.playTone(35, 'sine', 0.15, 0.4, time);
    }
    
    // High Hat (16ths)
    if (step % 2 === 0) {
        // Accent off beats
        const vol = (step % 4 === 2) ? 0.05 : 0.02; 
        this.playTone(4000, 'sawtooth', 0.02, vol, time);
    }
    
    // Snare
    if (step % 8 === 4) {
        this.playTone(200, 'triangle', 0.05, 0.2, time);
        this.playTone(400, 'square', 0.05, 0.1, time);
    }
    
    // Bass Arp (Sawtooth) - D minor driving
    // D2 - D2 - F2 - D2 - A2 - G2 - F2 - E2
    const bassNotes = [73.42, 73.42, 87.31, 73.42, 110.00, 98.00, 87.31, 82.41];
    if (step % 4 === 0 || step % 4 === 2) {
        const noteIdx = Math.floor(step / 4);
        this.playTone(bassNotes[noteIdx], 'sawtooth', 0.1, 0.15, time);
    }
    
    // Lead (Square wave bloops)
    if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
        // D5, F5, A5
        const lead = [587.33, 698.46, 880.00];
        const note = lead[Math.floor(Math.random() * lead.length)];
        this.playTone(note, 'square', 0.05, 0.05, time);
    }
  }

  private scheduleAdvancedNote(beatNumber: number, time: number) {
    const step = beatNumber % 64; 
    let bassFreq = 0;
    if (step < 16) bassFreq = 55.00; 
    else if (step < 32) bassFreq = 43.65; 
    else if (step < 48) bassFreq = 65.41; 
    else bassFreq = 49.00; 
    if (step % 2 === 0) this.playTone(bassFreq, 'sawtooth', 0.1, 0.15, time);
    else if (step % 2 === 1) this.playTone(bassFreq * 2, 'sawtooth', 0.08, 0.1, time);
    if (step % 2 === 0) {
        const vol = (step % 4 === 2) ? 0.04 : 0.015; 
        this.playTone(8000, 'square', 0.01, vol, time);
    }
    if (step % 8 === 0) { 
        this.playTone(60, 'sine', 0.05, 0.3, time);
        this.playTone(30, 'square', 0.1, 0.2, time); 
    }
    if (step % 8 === 4) { 
        this.playTone(200, 'square', 0.05, 0.15, time);
        this.playTone(150, 'sawtooth', 0.1, 0.1, time);
    }
    const arpVol = 0.06;
    let arpNote = 0;
    const am = [440, 523.25, 659.25, 880]; 
    const f = [349.23, 440, 523.25, 698.46]; 
    const c = [523.25, 659.25, 783.99, 1046.50]; 
    const g = [392.00, 493.88, 587.33, 783.99]; 
    let currentChord = am;
    if (step >= 16 && step < 32) currentChord = f;
    if (step >= 32 && step < 48) currentChord = c;
    if (step >= 48) currentChord = g;
    const patternIndex = step % 8; 
    const chordIndex = [0, 1, 2, 3, 2, 1, 0, 1][patternIndex];
    arpNote = currentChord[chordIndex];
    if (step % 16 !== 14 && step % 16 !== 15) this.playTone(arpNote, 'sine', 0.08, arpVol, time);
  }

  private scheduleBossNote(beatNumber: number, time: number) {
    const step = beatNumber % 64; 
    const isKick = (step % 8 === 0) || (step % 16 === 10) || (step === 26) || (step === 58);
    if (isKick) {
         this.playTone(50, 'square', 0.1, 0.4, time);
         this.playTone(30, 'sine', 0.1, 0.5, time);
    }
    if (step % 8 === 4) {
         this.playTone(180, 'square', 0.08, 0.2, time);
         this.playTone(120, 'sawtooth', 0.15, 0.2, time); 
    }
    const playBass = (freq: number) => this.playTone(freq, 'sawtooth', 0.1, 0.25, time);
    const bassRhythm = [true, false, true, true, false, true, false, false]; 
    if (bassRhythm[step % 8]) {
        if (step < 32) {
            if (step % 4 === 0) playBass(41.20); 
            else playBass(49.00); 
        } else {
            if (step < 40) playBass(41.20); 
            else if (step < 48) playBass(43.65); 
            else if (step < 56) playBass(46.25); 
            else playBass(49.00); 
        }
    }
    if (step % 2 === 0) {
        let note = 0;
        if (step < 32) note = (step % 16 < 8) ? 311.13 : 293.66; 
        else {
             const base = 440; 
             note = base + (step - 32) * 5; 
        }
        if (step >= 32 || step % 8 === 0) this.playTone(note, 'triangle', 0.1, 0.1, time);
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    const step = beatNumber % 64; 
    if (step % 8 === 0) this.playTone(80, 'sine', 0.05, 0.2, time); 
    if (step % 8 === 4) {
        this.playTone(200, 'square', 0.05, 0.1, time);
        this.playTone(150, 'sawtooth', 0.1, 0.05, time);
    }
    if (step % 2 === 0) this.playTone(6000, 'square', 0.01, 0.03, time);
    let root = 65.41; 
    if (step >= 16 && step < 32) root = 49.00; 
    if (step >= 32 && step < 48) root = 55.00; 
    if (step >= 48) root = 87.31; 
    if (step % 2 === 0) {
        const note = (step % 4 === 0) ? root : root * 1.5; 
        this.playTone(note, 'sawtooth', 0.12, 0.15, time);
    }
    const melodyVol = 0.08;
    if (step === 0) this.playTone(523.25, 'sine', 0.2, melodyVol, time); 
    if (step === 4) this.playTone(587.33, 'sine', 0.2, melodyVol, time); 
    if (step === 8) this.playTone(659.25, 'sine', 0.2, melodyVol, time); 
    if (step === 12) this.playTone(783.99, 'sine', 0.2, melodyVol, time); 
    if (step === 14) this.playTone(659.25, 'sine', 0.1, melodyVol, time); 
    if (step === 16) this.playTone(587.33, 'sine', 0.2, melodyVol, time); 
    if (step === 20) this.playTone(493.88, 'sine', 0.2, melodyVol, time); 
    if (step === 24) this.playTone(392.00, 'sine', 0.2, melodyVol, time); 
    if (step === 28) this.playTone(293.66, 'sine', 0.2, melodyVol, time); 
    if (step === 32) this.playTone(440.00, 'sine', 0.2, melodyVol, time); 
    if (step === 36) this.playTone(523.25, 'sine', 0.2, melodyVol, time); 
    if (step === 40) this.playTone(659.25, 'sine', 0.2, melodyVol, time); 
    if (step === 44) this.playTone(880.00, 'sine', 0.2, melodyVol, time); 
    if (step === 48) this.playTone(440.00, 'sine', 0.2, melodyVol, time); 
    if (step === 52) this.playTone(349.23, 'sine', 0.2, melodyVol, time); 
    if (step === 56) this.playTone(523.25, 'sine', 0.2, melodyVol, time); 
    if (step === 60) this.playTone(698.46, 'sine', 0.2, melodyVol, time); 
  }
}

export const sounds = new SoundManager();
