// ============================================================
// 절차적 사운드 엔진 — 외부 오디오 파일 없이 Web Audio API로 합성.
// 엔벨로프 + 필터 + 약한 리버브를 적용해 단순 비프음보다 풍부하게.
// ============================================================

class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverbSend = null;
    this.enabled = true;
    this.lastPlay = {}; // 동시 다발 사운드 스팸 방지용 쓰로틀
  }

  // 최초 사용자 입력 시 호출 (브라우저 오토플레이 정책 대응)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    // 짧은 임펄스 리버브 (합성 공간감)
    const convolver = this.ctx.createConvolver();
    convolver.buffer = this._makeImpulse(1.1, 2.2);
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.16;
    convolver.connect(reverbGain);
    reverbGain.connect(this.master);
    this.reverbSend = convolver;

    this.startMusic("title");
  }

  setEnabled(v) { this.enabled = v; }

  // ============ 배경음악 ============
  // 타이틀 화면(잔잔한 앰비언트)과 실제 플레이 화면(디스코/일렉트로닉, 빠르고
  // 신나는 우주 느낌)에서 서로 다른 트랙이 돌아간다.
  startMusic(mode) {
    if (!this.ctx) return;
    if (this._musicPlaying && this._musicMode === mode) return;
    this._musicMode = mode;
    this._musicPlaying = true;
    if (this._musicTimer) clearTimeout(this._musicTimer);

    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      // 참고: SFX용 master(0.55)를 거치지 않고 destination에 바로 연결한다.
      // master를 거치면 실제 출력이 훨씬 작아져서 잘 안 들렸음.
      this.musicGain.connect(this.ctx.destination);
    }
    // 타이틀 화면 음악이 게임 화면보다 훨씬 조용하게 들린다는 피드백이 있어
    // 둘의 목표 볼륨을 동일한 수준으로 맞춘다 (타이틀은 악기 수가 적어서
    // 그것만으로는 부족하므로, 아래 _playArpeggio/_playBass의 개별 게인도 올림).
    const target = mode === "game" ? 0.78 : 0.78;
    const t0 = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t0);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t0);
    this.musicGain.gain.linearRampToValueAtTime(target, t0 + 1.4);

    // 트랙 전환용 크로스페이드 버스. 이전 트랙(예: 타이틀의 6.4초짜리 긴 패드
    // 음)이 이미 재생을 시작했으면 setTimeout만 끊어봤자 그 소리는 끝까지
    // 울리기 때문에, 트랙마다 자기만의 게인 노드를 두고 전환 시 이전 것을
    // 빠르게 죽여서 "두 곡이 동시에 들리는" 문제를 막는다.
    if (this._modeGainNode) {
      const old = this._modeGainNode;
      old.gain.cancelScheduledValues(t0);
      old.gain.setValueAtTime(old.gain.value, t0);
      old.gain.linearRampToValueAtTime(0, t0 + 0.2);
    }
    const modeGain = this.ctx.createGain();
    modeGain.gain.value = 0;
    modeGain.connect(this.musicGain);
    modeGain.gain.linearRampToValueAtTime(1, t0 + 0.3);
    this._modeGainNode = modeGain;

    this._chordIdx = 0;
    this._musicStep();
  }

  // 이미 재생 중이면 트랙만 부드럽게 바꾼다 (씬 전환 시 호출)
  setMusicMode(mode) {
    if (!this.ctx || this._musicMode === mode) return;
    this.startMusic(mode);
  }

  stopMusic() {
    if (!this._musicPlaying) return;
    this._musicPlaying = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
    if (this.musicGain && this.ctx) {
      const g = this.musicGain;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);
    }
  }

  _musicStep() {
    if (!this._musicPlaying || !this.ctx) return;
    if (this._musicMode === "game") this._musicStepGame();
    else this._musicStepTitle();
  }

  _musicStepTitle() {
    const barDur = 6.4;
    const chords = [
      [110.0, 164.81, 220.0, 261.63],   // Am
      [87.31, 130.81, 174.61, 220.0],   // F
      [98.0, 146.83, 196.0, 246.94],    // Gsus-ish
      [82.41, 130.81, 164.81, 220.0],   // Em/G
    ];
    const chord = chords[this._chordIdx % chords.length];
    this._playPad(chord, barDur);
    this._playBass(chord, barDur);
    this._playArpeggio(chord, barDur);
    this._chordIdx++;
    this._musicTimer = setTimeout(() => this._musicStep(), barDur * 1000);
  }

  // 플레이 화면용 — 디스코/일렉트로닉 4온더플로어 그루브 (Cm - Ab - Eb - Bb)
  _musicStepGame() {
    const barDur = 2.0;
    const chords = [
      [130.81, 155.56, 196.0, 261.63],   // Cm
      [103.83, 130.81, 155.56, 207.65],  // Ab
      [155.56, 196.0, 233.08, 311.13],   // Eb
      [116.54, 146.83, 174.61, 233.08],  // Bb
    ];
    const chord = chords[this._chordIdx % chords.length];
    this._playPad(chord, barDur * 1.9);
    this._playKick(barDur);
    this._playDiscoBass(chord, barDur);
    this._playHihat(barDur);
    this._playLead(chord, barDur);
    this._chordIdx++;
    this._musicTimer = setTimeout(() => this._musicStep(), barDur * 1000);
  }

  // 4온더플로어 킥
  _playKick(barDur) {
    const beatDur = barDur / 4;
    for (let i = 0; i < 4; i++) {
      const t0 = this.ctx.currentTime + i * beatDur;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, t0);
      osc.frequency.exponentialRampToValueAtTime(46, t0 + 0.11);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.42, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(g); g.connect(this._modeGainNode);
      osc.start(t0); osc.stop(t0 + 0.24);
    }
  }

  // 8분음표 디스코 베이스 (온비트 근음 / 오프비트 옥타브 고스트노트)
  _playDiscoBass(freqs, barDur) {
    const stepDur = barDur / 8;
    const root = freqs[0];
    for (let i = 0; i < 8; i++) {
      const t0 = this.ctx.currentTime + i * stepDur;
      const onBeat = i % 2 === 0;
      const f = onBeat ? root : root * 2;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t0);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = onBeat ? 480 : 900;
      const g = this.ctx.createGain();
      const peak = onBeat ? 0.24 : 0.11;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.002, t0 + stepDur * 0.8);
      osc.connect(filter); filter.connect(g); g.connect(this._modeGainNode);
      osc.start(t0); osc.stop(t0 + stepDur);
    }
  }

  // 오프비트 하이햇 (그루브)
  _playHihat(barDur) {
    const stepDur = barDur / 8;
    for (let i = 1; i < 8; i += 2) {
      const t0 = this.ctx.currentTime + i * stepDur;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * 0.05));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let s = 0; s < len; s++) data[s] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass"; filter.frequency.value = 6500;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.13, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
      src.connect(filter); filter.connect(g); g.connect(this._modeGainNode);
      src.start(t0); src.stop(t0 + 0.05);
    }
  }

  // 밝은 신스 리드 리프 (전자/디스코 느낌의 반복 리프)
  _playLead(freqs, barDur) {
    const stepDur = barDur / 8;
    const pattern = [3, 2, 1, 2, 3, 2, 3, 1];
    pattern.forEach((idx, i) => {
      const t0 = this.ctx.currentTime + i * stepDur;
      const f = freqs[idx] * 2;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t0);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 2200; filter.Q.value = 1.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + stepDur * 0.75);
      osc.connect(filter); filter.connect(g); g.connect(this._modeGainNode); g.connect(this.reverbSend);
      osc.start(t0); osc.stop(t0 + stepDur);
    });
  }

  _playPad(freqs, dur) {
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(f, t0);
      const detune = this.ctx.createOscillator();
      detune.type = osc.type;
      detune.frequency.setValueAtTime(f * 1.004, t0);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100 - i * 120;

      const g = this.ctx.createGain();
      const peak = (0.17 - i * 0.015);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(peak * 0.7, t0 + dur * 0.7);
      g.gain.linearRampToValueAtTime(0, t0 + dur * 1.02);

      osc.connect(filter); detune.connect(filter);
      filter.connect(g); g.connect(this._modeGainNode); g.connect(this.reverbSend);
      osc.start(t0); detune.start(t0);
      osc.stop(t0 + dur * 1.05); detune.stop(t0 + dur * 1.05);
    });
  }

  // 코드 근음을 따라가는 리드미컬한 베이스 펄스 (박자 4번, 3번째 박은 5도 위로)
  // 기존엔 38~52Hz라 랩탑/폰 스피커에서 거의 안 들렸음 - 코드 근음 자체(82~110Hz대,
  // triangle 파형으로 배음을 살림) 를 써서 어떤 스피커에서도 또렷이 들리게 함.
  _playBass(freqs, barDur) {
    const beatDur = barDur / 4;
    const root = freqs[0];
    for (let i = 0; i < 4; i++) {
      const t0 = this.ctx.currentTime + i * beatDur;
      const f = i === 2 ? root * 1.5 : root;
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t0);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.3, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.002, t0 + beatDur * 0.85);
      osc.connect(filter); filter.connect(g); g.connect(this._modeGainNode);
      osc.start(t0); osc.stop(t0 + beatDur);
    }
  }

  // 코드 위를 도는 반복 아르페지오 멜로디 (매 마디 같은 패턴 -> "음악"으로 뚜렷하게 들림)
  _playArpeggio(freqs, barDur) {
    const stepDur = barDur / 8;
    const pattern = [1, 2, 3, 2, 1, 2, 3, 2];
    pattern.forEach((idx, i) => {
      const t0 = this.ctx.currentTime + i * stepDur + stepDur * 0.05;
      const f = freqs[idx] * 2;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t0);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = f; filter.Q.value = 3;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.19, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.002, t0 + stepDur * 0.9);
      osc.connect(filter); filter.connect(g); g.connect(this._modeGainNode); g.connect(this.reverbSend);
      osc.start(t0); osc.stop(t0 + stepDur);
    });
  }

  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _throttle(key, minGapMs) {
    const now = performance.now();
    if (this.lastPlay[key] && now - this.lastPlay[key] < minGapMs) return false;
    this.lastPlay[key] = now;
    return true;
  }

  // ---- 저수준 빌딩 블록 ----
  _env(gainNode, t0, { attack = 0.005, decay = 0.08, sustain = 0, release = 0.05, peak = 1 }) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(peak, t0 + attack);
    g.linearRampToValueAtTime(sustain * peak, t0 + attack + decay);
    g.linearRampToValueAtTime(0, t0 + attack + decay + release);
  }

  _tone({ freq = 440, sweepTo = null, type = "sine", dur = 0.2, gain = 0.3, filterFreq = null, filterType = "lowpass", wet = 0.5, ...envOpts }) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);

    const g = this.ctx.createGain();
    this._env(g, t0, { peak: gain, release: dur * 0.6, decay: dur * 0.3, ...envOpts });

    let node = osc;
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = filterFreq;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master);
    if (wet > 0) g.connect(this.reverbSend);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.2, gain = 0.25, filterFreq = 1200, filterType = "bandpass", Q = 1, wet = 0.3, ...envOpts }) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    f.Q.value = Q;

    const g = this.ctx.createGain();
    this._env(g, t0, { peak: gain, decay: dur * 0.4, release: dur * 0.5, ...envOpts });

    src.connect(f); f.connect(g); g.connect(this.master);
    if (wet > 0) g.connect(this.reverbSend);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ============ 타워 발사음 ============
  shoot(towerId) {
    if (!this._throttle("shoot_" + towerId, 40)) return;
    switch (towerId) {
      case "basic":
        this._tone({ freq: 720, sweepTo: 340, type: "square", dur: 0.09, gain: 0.16, filterFreq: 2600 });
        break;
      case "cannon":
        this._tone({ freq: 160, sweepTo: 60, type: "sine", dur: 0.22, gain: 0.35 });
        this._noise({ dur: 0.15, gain: 0.22, filterFreq: 900, filterType: "lowpass" });
        break;
      case "frost":
        this._tone({ freq: 900, sweepTo: 1500, type: "triangle", dur: 0.16, gain: 0.15, filterFreq: 4000 });
        this._tone({ freq: 1300, sweepTo: 1900, type: "sine", dur: 0.14, gain: 0.1, attack: 0.02 });
        break;
      case "sniper":
        this._tone({ freq: 2200, sweepTo: 400, type: "sawtooth", dur: 0.14, gain: 0.18, filterFreq: 5000 });
        this._noise({ dur: 0.06, gain: 0.18, filterFreq: 3000, filterType: "highpass" });
        break;
      case "poison":
        this._tone({ freq: 380, sweepTo: 520, type: "sine", dur: 0.18, gain: 0.14 });
        break;
      case "tesla":
        this._noise({ dur: 0.12, gain: 0.22, filterFreq: 2200, filterType: "bandpass", Q: 3 });
        this._tone({ freq: 220, type: "square", dur: 0.08, gain: 0.1, filterFreq: 1200 });
        break;
    }
  }

  hitImpact() {
    if (!this._throttle("hit", 60)) return;
    this._noise({ dur: 0.08, gain: 0.12, filterFreq: 2500, filterType: "highpass" });
  }

  explosion() {
    if (!this._throttle("explosion", 60)) return;
    this._tone({ freq: 120, sweepTo: 40, type: "sine", dur: 0.35, gain: 0.4 });
    this._noise({ dur: 0.3, gain: 0.3, filterFreq: 700, filterType: "lowpass" });
  }

  enemyDeath() {
    if (!this._throttle("death", 30)) return;
    this._noise({ dur: 0.12, gain: 0.16, filterFreq: 1800, filterType: "bandpass", Q: 2 });
    this._tone({ freq: 500, sweepTo: 90, type: "sawtooth", dur: 0.14, gain: 0.12 });
  }

  lifeLost() {
    this._tone({ freq: 300, sweepTo: 140, type: "square", dur: 0.35, gain: 0.22, filterFreq: 1000 });
    this._tone({ freq: 220, sweepTo: 100, type: "square", dur: 0.35, gain: 0.18, attack: 0.08, filterFreq: 900 });
  }

  waveStart() {
    [0, 0.09, 0.18].forEach((t, i) => {
      setTimeout(() => this._tone({ freq: 440 * Math.pow(1.26, i), type: "triangle", dur: 0.16, gain: 0.2, filterFreq: 3000 }), t * 1000);
    });
  }

  place() {
    this._tone({ freq: 520, sweepTo: 900, type: "triangle", dur: 0.1, gain: 0.2 });
  }

  error() {
    this._tone({ freq: 180, type: "square", dur: 0.14, gain: 0.18, filterFreq: 700 });
  }

  upgrade() {
    [0, 0.07, 0.14].forEach((t, i) => {
      setTimeout(() => this._tone({ freq: 500 * Math.pow(1.33, i), type: "sine", dur: 0.16, gain: 0.22, filterFreq: 4000 }), t * 1000);
    });
  }

  uiClick() {
    this._tone({ freq: 700, type: "triangle", dur: 0.045, gain: 0.12 });
  }

  gameOverWin() {
    [0, 0.14, 0.28, 0.42].forEach((t, i) => {
      setTimeout(() => this._tone({ freq: 392 * Math.pow(1.19, i), type: "triangle", dur: 0.3, gain: 0.22, filterFreq: 4000 }), t * 1000);
    });
  }

  gameOverLose() {
    [0, 0.16].forEach((t, i) => {
      setTimeout(() => this._tone({ freq: 220 / Math.pow(1.19, i), sweepTo: 80, type: "sawtooth", dur: 0.5, gain: 0.22, filterFreq: 900 }), t * 1000);
    });
  }

  bossAlert() {
    this._tone({ freq: 110, type: "sawtooth", dur: 0.6, gain: 0.28, filterFreq: 500 });
    this._noise({ dur: 0.4, gain: 0.15, filterFreq: 1500, filterType: "bandpass" });
  }
}

const Sfx = new AudioSynth();
