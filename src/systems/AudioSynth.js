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

  // 최초 사용자 입력 시 호출 (브라우저 오토플레이 정책 대응).
  // AudioContext 생성 자체는(자동재생 정책 통과를 위해) 클릭 이벤트 안에서
  // 바로 해야 하지만, 리버브 임펄스 생성 + 배경음악 시작은 굳이 그 안에서
  // 동기로 끝낼 필요가 없다. 이걸 전부 한 번에 처리하면 첫 클릭 때(타이틀
  // 화면 클릭 → 게임 화면 전환 시점) 60~90ms 정도 메인 스레드가 멎어서
  // "시작할 때 버벅인다"는 느낌을 줬다 — 화면 전환을 가로막지 않도록
  // 한 틱 뒤로 미룸(_tone/_noise는 reverbSend가 아직 없어도 죽지 않게
  // null 체크를 해뒀으니 그 사이에 UI 클릭음 등이 나도 안전함).
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

    setTimeout(() => {
      // 짧은 임펄스 리버브 (합성 공간감)
      const convolver = this.ctx.createConvolver();
      convolver.buffer = this._makeImpulse(0.6, 2.2);
      const reverbGain = this.ctx.createGain();
      reverbGain.gain.value = 0.16;
      convolver.connect(reverbGain);
      reverbGain.connect(this.master);
      this.reverbSend = convolver;

      this.startMusic("title");
    }, 0);
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
    // 최종보스 트랙의 라이저 임팩트가 예약된 채로 트랙이 바뀌면(예: 게임 종료 →
    // 타이틀 복귀) 엉뚱한 모드의 버스에 늦게 터지는 걸 방지
    if (this._musicImpactTimer) clearTimeout(this._musicImpactTimer);

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
    const target = mode === "boss" ? 0.85 : mode === "midboss" ? 0.82 : 0.78;
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

    // 그루브 버스 — 킥/베이스/하이햇/패드/리드는 modeGainNode로 바로 가지 않고
    // 이 버스를 거친다. 평소엔 게인 1로 아무 영향이 없지만, 최종보스 트랙에서
    // 라이저가 차오르는 동안 이 버스만 살짝 눌러서(_duckGroove) 라이저(보스의
    // 울음소리)가 그루브를 뚫고 확실히 들리게 만든다.
    const grooveGain = this.ctx.createGain();
    grooveGain.gain.value = 1;
    grooveGain.connect(modeGain);
    this._grooveGain = grooveGain;

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
    if (this._musicImpactTimer) clearTimeout(this._musicImpactTimer);
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
    else if (this._musicMode === "midboss") this._musicStepMidBoss();
    else if (this._musicMode === "boss") this._musicStepFinalBoss();
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

  // 중간보스(6웨이브) 전용 — 원래 최종보스용으로 썼던 트랙을 그대로 재사용.
  // 게임 브금(2.0s/마디)보다 훨씬 빠르고(1.15s/마디), 반음씩 내려가는 어둡고
  // 불안정한 화음으로 "위기감"을 준다. 악기 구성 자체는 게임 브금과 동일하게
  // 재사용해서(킥/베이스/하이햇/리드) 새 악기를 만들 필요 없이 템포와 화성만으로
  // 긴박함을 만든다. 최종보스는 이보다 한 단계 더 무거운 전용 트랙을 쓴다
  // (아래 _musicStepFinalBoss 참고) — 평상시 → 중간보스 → 최종보스로 사운드가
  // 3단 계단식으로 상승하게 함.
  _musicStepMidBoss() {
    const barDur = 1.15;
    const chords = [
      [116.54, 138.59, 164.81, 207.65], // Bbm 계열
      [110.00, 130.81, 155.56, 196.00], // Am 계열
      [103.83, 123.47, 146.83, 185.00], // Abm 계열
      [98.00, 116.54, 138.59, 174.61],  // Gm 계열 — 한 바퀴 돌 때마다 반음씩 하강
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

  // 최종보스(12웨이브) 전용 — 중간보스 트랙의 긴박함은 유지하되, 거기에 "압도감/공포"를
  // 더한다. 그로울 베이스(링 모듈레이션으로 만든 괴물 울음 같은 저음) + 불규칙한 타이밍의
  // 트라이톤 스팅어(예측 불가능한 불안감) 위에, 8마디 주기로 차오르는 라이저가 얹힌다.
  // 이 라이저가 차오르는 동안엔 그루브(패드/킥/하이햇)를 자동으로 살짝 눌러(더킹) 라이저가
  // 배경음을 뚫고 "진짜 보스의 울음소리"처럼 들리게 하고, 정점에서 무거운 타격음으로 터진다.
  _musicStepFinalBoss() {
    const barDur = 1.0;
    const chords = [
      [116.54, 138.59, 164.81, 207.65],
      [110.00, 130.81, 155.56, 196.00],
      [103.83, 123.47, 146.83, 185.00],
      [98.00, 116.54, 138.59, 174.61],
    ];
    const riserCycle = 8;
    const chord = chords[this._chordIdx % chords.length];
    const barIdx = this._chordIdx % riserCycle;

    this._playPad(chord, barDur * 1.8, 0.7);
    this._playKick(barDur);
    this._playHihat(barDur);

    // 링모듈 그로울 — 8마디짜리 라이저 주기와 함께 새로 겹쳐 깐다(끊기지 않게 약간 겹침)
    if (barIdx === 0) this._playRingModGrowl(barDur * riserCycle + 0.3, 55);

    // 불규칙한 타이밍에 트라이톤 스팅어 — 매번 같은 자리가 아니라서 더 불안하게 만듦
    const stabOffsets = [0.15, 0.62, 0.38, 0.8];
    if (this._chordIdx % 2 === 1) {
      const t0 = this.ctx.currentTime + barDur * stabOffsets[this._chordIdx % stabOffsets.length];
      setTimeout(() => this._playTritoneStab(this.ctx.currentTime, chord[2], 0.22), Math.max(0, (t0 - this.ctx.currentTime) * 1000));
    }

    // 8마디 주기로 차오르는 라이저 + 그루브 더킹, 정점에서 임팩트
    if (barIdx === 0) {
      const buildDur = barDur * riserCycle * 0.94;
      this._playDarkRiser(this.ctx.currentTime, buildDur);
      this._duckGroove(this.ctx.currentTime, buildDur);
      const nextChord = chords[(this._chordIdx + riserCycle) % chords.length];
      this._musicImpactTimer = setTimeout(() => this._playHeavyImpact(this.ctx.currentTime, nextChord[2]), buildDur * 1000);
    }

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
      osc.connect(g); g.connect(this._grooveGain);
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
      osc.connect(filter); filter.connect(g); g.connect(this._grooveGain);
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
      src.connect(filter); filter.connect(g); g.connect(this._grooveGain);
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

  _playPad(freqs, dur, peakMult) {
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
      const peak = (0.17 - i * 0.015) * (peakMult || 1);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(peak * 0.7, t0 + dur * 0.7);
      g.gain.linearRampToValueAtTime(0, t0 + dur * 1.02);

      osc.connect(filter); detune.connect(filter);
      filter.connect(g); g.connect(this._grooveGain);
      if (this.reverbSend) g.connect(this.reverbSend);
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

  // ============ 최종보스 전용 악기 (공포/압도감) ============

  // 디스토션 커브 생성 (그로울/라이저의 뒤틀린 질감용)
  _makeDistortionCurve(amount) {
    const n = 44100, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // 링 모듈레이션 괴물 그로울 — 두 주파수가 맥놀이(beating)를 일으켜 "울음소리" 같은
  // 질감을 낸다. modeGainNode로 직행(그루브 버스를 거치지 않음 = 더킹 영향을 안 받는
  // "보스의 몸" 같은 상시 존재감).
  _playRingModGrowl(dur, baseFreq) {
    const t0 = this.ctx.currentTime;
    const carrier = this.ctx.createOscillator(); carrier.type = "sawtooth"; carrier.frequency.value = baseFreq || 55;
    const modulator = this.ctx.createOscillator(); modulator.type = "sine"; modulator.frequency.value = (baseFreq || 55) * 1.5;
    const ringGain = this.ctx.createGain(); ringGain.gain.value = 0;
    modulator.connect(ringGain.gain);
    const carrierGain = this.ctx.createGain(); carrierGain.gain.value = 1;
    const outGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 500;
    carrier.connect(carrierGain); carrierGain.connect(ringGain);
    ringGain.connect(filter); filter.connect(outGain); outGain.connect(this._modeGainNode);
    outGain.gain.setValueAtTime(0, t0);
    outGain.gain.linearRampToValueAtTime(0.22, t0 + 0.8);
    outGain.gain.setValueAtTime(0.22, t0 + dur - 0.6);
    outGain.gain.linearRampToValueAtTime(0, t0 + dur);
    carrier.start(t0); modulator.start(t0);
    carrier.stop(t0 + dur + 0.1); modulator.stop(t0 + dur + 0.1);
  }

  // 불규칙하게 튀어나오는 트라이톤 스팅어 — 규칙적이지 않아서 더 불안하게 만드는 효과.
  // modeGainNode로 직행(더킹 영향 없이 항상 또렷하게 찌르는 소리로 남긴다).
  _playTritoneStab(t0, freq, gain) {
    const osc1 = this.ctx.createOscillator(); osc1.type = "sawtooth"; osc1.frequency.value = freq;
    const osc2 = this.ctx.createOscillator(); osc2.type = "sawtooth"; osc2.frequency.value = freq * 1.4142; // 트라이톤
    const filter = this.ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = freq * 2; filter.Q.value = 3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain || 0.2, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.002, t0 + 0.5);
    osc1.connect(filter); osc2.connect(filter); filter.connect(g); g.connect(this._modeGainNode);
    osc1.start(t0); osc2.start(t0); osc1.stop(t0 + 0.55); osc2.stop(t0 + 0.55);
  }

  // 어두운 라이저 — 링모듈 그로울의 기본음(약 55Hz) 근처의 저음에서 시작해 서서히
  // 차오르는 "울음소리". 저음 몸통(lowGain) + 포효하는 "모음" 질감을 내는 포먼트
  // 레이어(formantGain)를 병렬로 겹치고, 살짝 흔들리는 비브라토를 얹어서 기계적인
  // 스윕이 아니라 진짜 살아있는 짐승이 울부짖는 느낌을 낸다. modeGainNode로 직행
  // (더킹은 그루브 쪽에서 걸므로 이쪽은 항상 원래 크기 그대로 또렷하게 들림).
  _playDarkRiser(t0, dur) {
    const vibrato = this.ctx.createOscillator(); vibrato.type = "sine"; vibrato.frequency.value = 5.5;
    const vibratoGain = this.ctx.createGain(); vibratoGain.gain.value = 5;
    vibrato.connect(vibratoGain);

    const osc = this.ctx.createOscillator(); osc.type = "sawtooth";
    osc.frequency.setValueAtTime(45, t0);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + dur);
    vibratoGain.connect(osc.frequency);
    const detune = this.ctx.createOscillator(); detune.type = "sawtooth";
    detune.frequency.setValueAtTime(45 * 1.01, t0);
    detune.frequency.exponentialRampToValueAtTime(240 * 1.01, t0 + dur);
    vibratoGain.connect(detune.frequency);
    const shaper = this.ctx.createWaveShaper(); shaper.curve = this._makeDistortionCurve(16); shaper.oversample = "2x";
    osc.connect(shaper); detune.connect(shaper);

    // 저음 몸통 (어둡고 무거운 축)
    const lowFilter = this.ctx.createBiquadFilter(); lowFilter.type = "lowpass"; lowFilter.Q.value = 3;
    lowFilter.frequency.setValueAtTime(120, t0);
    lowFilter.frequency.exponentialRampToValueAtTime(800, t0 + dur);
    const lowGain = this.ctx.createGain();
    lowGain.gain.setValueAtTime(0, t0);
    lowGain.gain.linearRampToValueAtTime(0.42, t0 + dur * 0.85);
    lowGain.gain.linearRampToValueAtTime(0, t0 + dur);
    shaper.connect(lowFilter); lowFilter.connect(lowGain); lowGain.connect(this._modeGainNode);

    // 포먼트 레이어 (포효하는 "모음" 질감 — 공명 밴드가 위로 열림)
    const formant = this.ctx.createBiquadFilter(); formant.type = "bandpass"; formant.Q.value = 7;
    formant.frequency.setValueAtTime(280, t0);
    formant.frequency.exponentialRampToValueAtTime(1300, t0 + dur);
    const formantGain = this.ctx.createGain();
    formantGain.gain.setValueAtTime(0, t0);
    formantGain.gain.linearRampToValueAtTime(0.24, t0 + dur * 0.9);
    formantGain.gain.linearRampToValueAtTime(0, t0 + dur);
    shaper.connect(formant); formant.connect(formantGain); formantGain.connect(this._modeGainNode);

    osc.start(t0); detune.start(t0); vibrato.start(t0);
    osc.stop(t0 + dur + 0.05); detune.stop(t0 + dur + 0.05); vibrato.stop(t0 + dur + 0.05);
  }

  // 라이저가 차오르는 동안 그루브(패드/킥/하이햇)를 살짝 눌러서(더킹) 라이저(보스의
  // 울음소리)가 믹스 위로 확실히 뚫고 나오게 한다. 정점(임팩트) 직후 빠르게 원래
  // 볼륨으로 복귀시켜 그루브가 계속 이어지게 함.
  _duckGroove(t0, buildDur) {
    const g = this._grooveGain;
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(1, t0);
    g.gain.linearRampToValueAtTime(0.4, t0 + buildDur * 0.6);
    g.gain.setValueAtTime(0.4, t0 + buildDur);
    g.gain.linearRampToValueAtTime(1, t0 + buildDur + 0.7);
  }

  // 라이저가 차오른 정점에서 터지는 묵직한 타격음 — 크고 낮은 킥 + 불협 스팅어를
  // 겹쳐서 "쌓아온 압박감이 한 번에 터진다"는 느낌을 줌
  _playHeavyImpact(t0, freq) {
    const osc = this.ctx.createOscillator(); osc.type = "sine";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.55, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.002, t0 + 0.9);
    osc.connect(g); g.connect(this._modeGainNode);
    osc.start(t0); osc.stop(t0 + 0.95);
    this._playTritoneStab(t0, freq, 0.26);
  }

  // 처음 화면을 클릭하는 순간(unlock) 이 함수가 동기적으로 실행되는데,
  // 예전엔 채널마다 Math.pow를 다시 계산해서(총 2*len번) 첫 클릭 때 90ms
  // 가까이 멎는 버벅임의 원인이었다. 감쇠 곡선(envelope)은 채널과 무관하게
  // 값이 같으므로 한 번만 계산해서 재사용 — 그리고 길이도 살짝 줄여서
  // (1.1s → 0.6s) 짧은 잔향으로도 충분한 수준까지만 남김.
  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    const env = new Float32Array(len);
    for (let i = 0; i < len; i++) env[i] = Math.pow(1 - i / len, decay);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * env[i];
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
    if (wet > 0 && this.reverbSend) g.connect(this.reverbSend);

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
    if (wet > 0 && this.reverbSend) g.connect(this.reverbSend);
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

  // 보스 등장 경고 사이렌 — 두 음 사이를 오르내리며 몇 초간 우는 진짜
  // "사이렌" 소리. 기존엔 단발 톤 하나뿐이라 경고감이 약했음.
  bossAlert() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const dur = 2.4;
    const cycles = 4; // 저음<->고음 왕복 횟수
    const low = 220, high = 520;

    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.26, t0 + 0.1);
    g.gain.setValueAtTime(0.26, t0 + dur - 0.2);
    g.gain.linearRampToValueAtTime(0, t0 + dur);

    const cycleDur = dur / cycles;
    osc.frequency.setValueAtTime(low, t0);
    for (let i = 1; i <= cycles * 2; i++) {
      const f = i % 2 === 1 ? high : low;
      osc.frequency.linearRampToValueAtTime(f, t0 + i * (cycleDur / 2));
    }

    osc.connect(filter); filter.connect(g); g.connect(this.master);
    if (this.reverbSend) g.connect(this.reverbSend);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);

    this._noise({ dur: 0.4, gain: 0.15, filterFreq: 1500, filterType: "bandpass" });
  }
}

const Sfx = new AudioSynth();
