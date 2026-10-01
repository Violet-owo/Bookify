// Audio Engine: Procedural low-latency mechanical switch & cozy soundscape synthesis

export const KEY_PROFILES = [
  {
    id: 'akko',
    name: 'Akko Lavender Purple',
    description: 'Switch tattile clacky, bump deciso e tono medio-basso',
    badge: 'Tattile Clack'
  },
  {
    id: 'thock',
    name: 'Deep Thock & Butter',
    description: 'Suono profondo, caldo, lubrificato e felpato (stile Gateron Milky)',
    badge: 'Deep Thock'
  },
  {
    id: 'hitmarker',
    name: 'Click Tattile Chirurgico',
    description: 'Click chirurgico ultra-rapido, secco e super soddisfacente',
    badge: 'Chirurgico'
  },
  {
    id: 'cherry_blue',
    name: 'Cherry MX Blue Clicky',
    description: 'Scatto metallico sonoro e brillante a ogni battuta',
    badge: 'Clicky Classico'
  },
  {
    id: 'gateron_black',
    name: 'Gateron Black Ink Oil',
    description: 'Basso cavernoso, vellutato e ultra-lubrificato per sessioni lunghe',
    badge: 'Ultra Deep'
  },
  {
    id: 'holy_panda',
    name: 'Holy Panda Snappy',
    description: 'Tactile bump rotondo ed energico con rimbalzo sonoro vivo',
    badge: 'Tactile King'
  },
  {
    id: 'topre',
    name: 'Topre Elettro-Capacitivo',
    description: 'Cupola in gomma ammortizzata con tipico "thock-pop" vellutato',
    badge: 'Topre Dome'
  },
  {
    id: 'bubble_wrap',
    name: 'Pluriball / Bubble Pop',
    description: 'Scoppio morbido ed elastico di bolle d\'aria antistress',
    badge: 'Anti-Stress'
  },
  {
    id: 'model_m',
    name: 'IBM Model M Vintage',
    description: 'Molla a scatto Buckling Spring con risonanza d\'acciaio anni 80',
    badge: 'Buckling Spring'
  },
  {
    id: 'typewriter',
    name: 'Olivetti Macchina da Scrivere',
    description: 'Battuta metallica vintage autentica con campanello su Invio',
    badge: 'Vintage'
  },
  {
    id: 'rain_keys',
    name: 'Gocce di Pioggia / Ceramica',
    description: 'Click cristallino e rilassante come biglie o gocce d\'acqua',
    badge: 'Cristallino'
  },
  {
    id: 'wooden',
    name: 'Tasti in Legno Caldo',
    description: 'Tocco organico e cavernoso di bambù e blocchi di legno',
    badge: 'Organico'
  },
  {
    id: 'velvet',
    name: 'Silent Velvet',
    description: 'Ammortizzato e vellutato, ideale per le sessioni notturne a luce soffusa',
    badge: 'Ultra Soft'
  }
];

export const AMBIENT_TRACKS = [
  { id: 'none', name: 'Nessun Sottofondo', description: 'Silenzio totale, solo il tocco dei tasti' },
  { id: 'rain', name: 'Pioggia sui Vetri', description: 'Scroscio morbido con gocce vive e modulazione a folate' },
  { id: 'fireplace', name: 'Camino in Biblioteca', description: 'Caldo riverbero di legna, fiamma che respira e crepitio' },
  { id: 'alpha', name: 'Onde Alpha 432Hz', description: 'Tappeto armonico puro per la concentrazione narrativa profonda' },
  { id: 'autumn', name: 'Vento d\'Autunno', description: 'Brezza soffice e rassicurante tra le fronde' },
  { id: 'cafe', name: 'Caffè Letterario', description: 'Atmosfera ovattata, calore acustico e porcellana lontana' },
  { id: 'vinyl', name: 'Vinile Lo-Fi Warmth', description: 'Calore analogico rilassante e fruscio vellutato' }
];

class CozyAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;

    this.volume = 0.55;
    this.enabled = true;
    this.activeProfile = 'akko';

    this.ambientTrack = 'none';
    this.ambientVolume = 0.35;
    this.ambientNodes = [];

    this.whiteNoiseBuffer = null;
    this.pinkNoiseBuffer = null;

    // Load saved settings
    try {
      const v = localStorage.getItem('bookify_audio_volume');
      const e = localStorage.getItem('bookify_audio_enabled');
      const p = localStorage.getItem('bookify_audio_profile');
      const at = localStorage.getItem('bookify_ambient_track');
      const av = localStorage.getItem('bookify_ambient_volume');

      if (v !== null) this.volume = parseFloat(v);
      if (e !== null) this.enabled = e === 'true';
      if (p) this.activeProfile = p;
      if (at) this.ambientTrack = at;
      if (av !== null) this.ambientVolume = parseFloat(av);
    } catch {}
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    // Master Gain for Keys
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Dedicated Gain for Ambient Sounds
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.ambientTrack !== 'none' ? this.ambientVolume : 0, this.ctx.currentTime);
    this.ambientGain.connect(this.ctx.destination);

    // Buffers for synthesis
    this.createBuffers();

    // Start ambient if set
    if (this.ambientTrack && this.ambientTrack !== 'none') {
      this.startAmbient(this.ambientTrack);
    }
  }

  createBuffers() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;

    // 1. White Noise Buffer (0.5s)
    const whiteSize = Math.floor(sampleRate * 0.5);
    this.whiteNoiseBuffer = this.ctx.createBuffer(1, whiteSize, sampleRate);
    const whiteData = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < whiteSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    // 2. Pink Noise Buffer (3s loop for rain / ambiance)
    const pinkSize = Math.floor(sampleRate * 3.0);
    this.pinkNoiseBuffer = this.ctx.createBuffer(2, pinkSize, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = this.pinkNoiseBuffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < pinkSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setProfile(profileId) {
    this.activeProfile = profileId;
    try {
      localStorage.setItem('bookify_audio_profile', profileId);
    } catch {}
  }

  setVolume(newVolume) {
    this.volume = Math.max(0, Math.min(1, newVolume));
    try {
      localStorage.setItem('bookify_audio_volume', this.volume.toString());
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    }
  }

  setEnabled(isEnabled) {
    this.enabled = isEnabled;
    try {
      localStorage.setItem('bookify_audio_enabled', isEnabled.toString());
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
    }
  }

  setAmbientTrack(trackId) {
    this.ambientTrack = trackId;
    try {
      localStorage.setItem('bookify_ambient_track', trackId);
    } catch {}
    this.ensureContext();
    this.stopAmbient();
    if (trackId !== 'none') {
      this.startAmbient(trackId);
    }
  }

  setAmbientVolume(vol) {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('bookify_ambient_volume', this.ambientVolume.toString());
    } catch {}
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(this.ambientTrack !== 'none' ? this.ambientVolume : 0, this.ctx.currentTime);
    }
  }

  /* =========================================================
     KEY CLICK DISPATCHER
     ========================================================= */
  playKey(key = '', code = '') {
    if (!this.enabled || this.volume <= 0) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const jitter = (Math.random() * 30) - 15; // ±15Hz natural random jitter
    const profile = this.activeProfile || 'akko';

    switch (profile) {
      case 'thock':
        this.synthesizeDeepThock(key, code, jitter);
        break;
      case 'hitmarker':
        this.synthesizeHitmarker(key, code, jitter);
        break;
      case 'cherry_blue':
        this.synthesizeCherryBlue(key, code, jitter);
        break;
      case 'gateron_black':
        this.synthesizeGateronBlack(key, code, jitter);
        break;
      case 'holy_panda':
        this.synthesizeHolyPanda(key, code, jitter);
        break;
      case 'topre':
        this.synthesizeTopre(key, code, jitter);
        break;
      case 'bubble_wrap':
        this.synthesizeBubbleWrap(key, code, jitter);
        break;
      case 'model_m':
        this.synthesizeModelM(key, code, jitter);
        break;
      case 'typewriter':
        this.synthesizeVintageTypewriter(key, code, jitter);
        break;
      case 'rain_keys':
        this.synthesizeRaindropKeys(key, code, jitter);
        break;
      case 'wooden':
        this.synthesizeWarmWood(key, code, jitter);
        break;
      case 'velvet':
        this.synthesizeSilentVelvet(key, code, jitter);
        break;
      case 'akko':
      default:
        this.synthesizeAkkoLavender(key, code, jitter);
        break;
    }
  }

  /* CLICK TATTILE CHIRURGICO (Ultra-fast snappy click) */
  synthesizeHitmarker(key, code, jitter) {
    const now = this.ctx.currentTime;
    if (!this.whiteNoiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200 + jitter * 8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400 + jitter * 4, now);
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.015);
    osc.start(now);
    osc.stop(now + 0.018);
  }

  /* CHERRY MX BLUE (Loud tactile click) */
  synthesizeCherryBlue(key, code, jitter) {
    const now = this.ctx.currentTime;
    const clickFreq = code === 'Space' ? 2400 : 3400 + jitter * 10;

    // Stage 1: Plastic click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(clickFreq, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.02);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

    // Stage 2: Metallic spring click
    if (this.whiteNoiseBuffer) {
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.whiteNoiseBuffer;
      const snapFilter = this.ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(4200, now);
      snapFilter.Q.setValueAtTime(6, now);
      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.38, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);
      snap.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(this.masterGain);
      snap.start(now);
      snap.stop(now + 0.02);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.025);
  }

  /* GATERON BLACK INK (Super deep buttery heavy thock) */
  synthesizeGateronBlack(key, code, jitter) {
    const now = this.ctx.currentTime;
    const baseFreq = code === 'Space' ? 70 : 88 + jitter * 0.4;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.045);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.Q.setValueAtTime(1.8, now);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  /* HOLY PANDA (Snappy tactile bump) */
  synthesizeHolyPanda(key, code, jitter) {
    const now = this.ctx.currentTime;
    const baseFreq = 165 + jitter;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.035);
    gain.gain.setValueAtTime(0.48, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    if (this.whiteNoiseBuffer) {
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.whiteNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2100, now);
      filter.Q.setValueAtTime(3.5, now);
      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.3, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      snap.connect(filter);
      filter.connect(snapGain);
      snapGain.connect(this.masterGain);
      snap.start(now);
      snap.stop(now + 0.02);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /* TOPRE (Electro-capacitive rubber dome pop) */
  synthesizeTopre(key, code, jitter) {
    const now = this.ctx.currentTime;
    const domeFreq = code === 'Space' ? 95 : 120 + jitter * 0.5;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(domeFreq * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(domeFreq * 0.5, now + 0.04);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(2.2, now);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  /* BUBBLE WRAP (Soft satisfying bubble pop) */
  synthesizeBubbleWrap(key, code, jitter) {
    const now = this.ctx.currentTime;
    const popFreq = 380 + Math.random() * 220 + jitter;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(popFreq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(popFreq * 0.4, now + 0.028);

    gain.gain.setValueAtTime(0.48, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  /* IBM MODEL M (Buckling Spring vintage ping) */
  synthesizeModelM(key, code, jitter) {
    const now = this.ctx.currentTime;

    // Metal Spring Ping
    const spring = this.ctx.createOscillator();
    const springGain = this.ctx.createGain();
    spring.type = 'sine';
    spring.frequency.setValueAtTime(1850 + jitter * 6, now);
    springGain.gain.setValueAtTime(0.28, now);
    springGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    // Mechanical Plastic Slam
    const slam = this.ctx.createOscillator();
    const slamGain = this.ctx.createGain();
    slam.type = 'triangle';
    slam.frequency.setValueAtTime(140 + jitter, now);
    slam.frequency.exponentialRampToValueAtTime(60, now + 0.035);
    slamGain.gain.setValueAtTime(0.45, now);
    slamGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    spring.connect(springGain);
    springGain.connect(this.masterGain);
    slam.connect(slamGain);
    slamGain.connect(this.masterGain);

    spring.start(now);
    spring.stop(now + 0.07);
    slam.start(now);
    slam.stop(now + 0.04);
  }

  /* 1. AKKO LAVENDER PURPLE (Crisp tactile clack) */
  synthesizeAkkoLavender(key, code, jitter) {
    const now = this.ctx.currentTime;
    let basePitch = 145 + jitter;
    let clackFreq = 1950 + (Math.random() * 200 - 100);
    let resonanceFreq = 720 + jitter * 2;
    let decayMultiplier = 1;
    let impactVol = 0.45;

    if (code === 'Space' || key === ' ') {
      basePitch = 110 + jitter;
      clackFreq = 1400;
      resonanceFreq = 540;
      impactVol = 0.55;
      decayMultiplier = 1.35;
    } else if (code === 'Enter') {
      basePitch = 120 + jitter;
      clackFreq = 1600;
      resonanceFreq = 610;
      decayMultiplier = 1.25;
    } else if (code === 'Backspace' || code === 'Delete') {
      basePitch = 160 + jitter;
      clackFreq = 2200;
      resonanceFreq = 840;
      impactVol = 0.4;
      decayMultiplier = 0.9;
    }

    // Thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(basePitch * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, basePitch * 0.6), now + 0.038 * decayMultiplier);
    oscGain.gain.setValueAtTime(impactVol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042 * decayMultiplier);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045 * decayMultiplier);

    // Clack
    if (this.whiteNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.whiteNoiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(clackFreq, now);
      noiseFilter.Q.setValueAtTime(4.5, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018 * decayMultiplier);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.02 * decayMultiplier);
    }

    // Ping
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(resonanceFreq, now);
    pingGain.gain.setValueAtTime(0.18, now);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028 * decayMultiplier);
    ping.connect(pingGain);
    pingGain.connect(this.masterGain);
    ping.start(now);
    ping.stop(now + 0.032 * decayMultiplier);
  }

  /* 2. DEEP THOCK & BUTTER (Warm, deep, muted thud) */
  synthesizeDeepThock(key, code, jitter) {
    const now = this.ctx.currentTime;
    let basePitch = 88 + (jitter * 0.7);
    let vol = 0.65;
    let decay = 0.055;

    if (code === 'Space' || key === ' ') {
      basePitch = 70 + jitter;
      vol = 0.8;
      decay = 0.075;
    } else if (code === 'Enter') {
      basePitch = 78 + jitter;
      vol = 0.75;
      decay = 0.065;
    }

    // Heavy low-frequency body thock
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(basePitch * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch, now + decay);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + decay);

    // Muted top-out soft pop
    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(basePitch * 2.8, now);
    pop.frequency.exponentialRampToValueAtTime(basePitch * 1.2, now + 0.025);
    popGain.gain.setValueAtTime(vol * 0.35, now);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    pop.connect(popGain);
    popGain.connect(this.masterGain);
    pop.start(now);
    pop.stop(now + 0.03);
  }

  /* 3. VINTAGE TYPEWRITER (Metallic striker & bell on Enter) */
  synthesizeVintageTypewriter(key, code, jitter) {
    const now = this.ctx.currentTime;

    // Metal key strike
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580 + jitter * 4, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);

    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    const metalFilter = this.ctx.createBiquadFilter();
    metalFilter.type = 'bandpass';
    metalFilter.frequency.setValueAtTime(2200 + jitter * 10, now);
    metalFilter.Q.setValueAtTime(6.0, now);

    osc.connect(metalFilter);
    metalFilter.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);

    // Mechanical snap
    if (this.whiteNoiseBuffer) {
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.whiteNoiseBuffer;
      const snapFilter = this.ctx.createBiquadFilter();
      snapFilter.type = 'highpass';
      snapFilter.frequency.setValueAtTime(3200, now);
      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.3, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      snap.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(this.masterGain);
      snap.start(now);
      snap.stop(now + 0.018);
    }

    // Carriage Return Bell on Enter!
    if (code === 'Enter') {
      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(2480, now + 0.02);
      bellGain.gain.setValueAtTime(0.35, now + 0.02);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      bell.connect(bellGain);
      bellGain.connect(this.masterGain);
      bell.start(now + 0.02);
      bell.stop(now + 0.38);
    }
  }

  /* 4. RAINDROP / CERAMIC KEYS (Crystalline clink) */
  synthesizeRaindropKeys(key, code, jitter) {
    const now = this.ctx.currentTime;
    const baseFreq = 1600 + jitter * 12;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.015);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.04);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);

    // High harmonic ping
    const overtone = this.ctx.createOscillator();
    const otGain = this.ctx.createGain();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(baseFreq * 2.2, now);
    otGain.gain.setValueAtTime(0.12, now);
    otGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    overtone.connect(otGain);
    otGain.connect(this.masterGain);
    overtone.start(now);
    overtone.stop(now + 0.025);
  }

  /* 5. WARM WOOD (Hollow teak & bamboo blocks) */
  synthesizeWarmWood(key, code, jitter) {
    const now = this.ctx.currentTime;
    const pitch = 380 + jitter * 3;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch * 2, now);
    osc.frequency.exponentialRampToValueAtTime(pitch, now + 0.03);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(pitch, now);
    filter.Q.setValueAtTime(7.0, now);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.042);
  }

  /* 6. SILENT VELVET (Ultra soft midnight tactile) */
  synthesizeSilentVelvet(key, code, jitter) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 + jitter * 0.5, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.04);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(210, now);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /* =========================================================
     ELEVATED COZY PROCEDURAL AMBIENT SOUNDSCAPES
     ========================================================= */
  stopAmbient(fadeTime = 0.8) {
    if (this.ambientNodes.length === 0) return;
    
    // Smooth fade out
    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);
    }

    const oldNodes = [...this.ambientNodes];
    this.ambientNodes = [];

    setTimeout(() => {
      oldNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch {}
      });
    }, (fadeTime + 0.1) * 1000);
  }

  startAmbient(trackId) {
    if (!this.ctx || !this.ambientGain || trackId === 'none') {
      this.ambientTrack = 'none';
      this.stopAmbient(0.4);
      return;
    }
    
    this.stopAmbient(0.3);
    this.ambientTrack = trackId;

    const now = this.ctx.currentTime;
    this.ambientGain.gain.setValueAtTime(0.0001, now);
    this.ambientGain.gain.linearRampToValueAtTime(this.ambientVolume, now + 1.2);

    if (trackId === 'rain') {
      this.buildRainAmbiance();
    } else if (trackId === 'fireplace') {
      this.buildFireplaceAmbiance();
    } else if (trackId === 'alpha') {
      this.buildAlphaWavesAmbiance();
    } else if (trackId === 'wind' || trackId === 'autumn') {
      this.buildAutumnWindAmbiance();
    } else if (trackId === 'cafe') {
      this.buildCafeAmbiance();
    } else if (trackId === 'vinyl') {
      this.buildVinylWarmthAmbiance();
    }
  }

  /**
   * 1. PIOGGIA DI MEZZANOTTE SUI VETRI
   * Multi-strato organico: fruscio continuo morbido + modulazione stereofonica a onda lenta
   * + gocce d'acqua casuali risonanti e sub-basso vellutato di tuono lontano.
   */
  buildRainAmbiance() {
    if (!this.pinkNoiseBuffer || !this.whiteNoiseBuffer) return;
    const now = this.ctx.currentTime;

    // Layer A: Pink Noise scroscio continuo morbido (High-cut naturale)
    const rainBed = this.ctx.createBufferSource();
    rainBed.buffer = this.pinkNoiseBuffer;
    rainBed.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(620, now);
    rainFilter.Q.setValueAtTime(0.7, now);

    const rainHighpass = this.ctx.createBiquadFilter();
    rainHighpass.type = 'highpass';
    rainHighpass.frequency.setValueAtTime(140, now);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.35, now);

    // LFO per dare il respiro organico delle folate di pioggia
    const rainLfo = this.ctx.createOscillator();
    rainLfo.frequency.setValueAtTime(0.12, now); // Ciclo lento ~8 secondi
    const rainLfoGain = this.ctx.createGain();
    rainLfoGain.gain.setValueAtTime(180, now); // Modula frequenza filtro

    rainLfo.connect(rainLfoGain);
    rainLfoGain.connect(rainFilter.frequency);
    rainLfo.start(now);

    rainBed.connect(rainHighpass);
    rainHighpass.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.ambientGain);
    rainBed.start(now);

    this.ambientNodes.push(rainBed, rainFilter, rainHighpass, rainGain, rainLfo, rainLfoGain);

    // Layer B: Gocce d'acqua sui vetri (micro-impulsi cristallini naturali)
    const dropInterval = setInterval(() => {
      if (this.ambientTrack !== 'rain' || !this.ctx) {
        clearInterval(dropInterval);
        return;
      }
      if (Math.random() > 0.35) {
        this.triggerRainDrop();
      }
    }, 280);

    this.ambientNodes.push({ stop: () => clearInterval(dropInterval) });
  }

  triggerRainDrop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    const baseFreq = 1200 + Math.random() * 1600;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, now + 0.04);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 0.8, now);
    filter.Q.setValueAtTime(4, now);

    const vol = 0.02 + Math.random() * 0.04;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * 2. CAMINO IN BIBLIOTECA
   * Risonanza calda e profonda di legna accesa, respiro morbido della fiamma
   * e scoppiettio naturale ovattato (non stridulo!).
   */
  buildFireplaceAmbiance() {
    if (!this.pinkNoiseBuffer) return;
    const now = this.ctx.currentTime;

    // Layer A: Base calda rotonda e vellutata (100Hz lowpass)
    const hearthBed = this.ctx.createBufferSource();
    hearthBed.buffer = this.pinkNoiseBuffer;
    hearthBed.loop = true;

    const hearthFilter = this.ctx.createBiquadFilter();
    hearthFilter.type = 'lowpass';
    hearthFilter.frequency.setValueAtTime(160, now);
    hearthFilter.Q.setValueAtTime(1.2, now);

    const hearthGain = this.ctx.createGain();
    hearthGain.gain.setValueAtTime(0.5, now);

    // LFO per l'ondeggiare della fiamma
    const fireLfo = this.ctx.createOscillator();
    fireLfo.frequency.setValueAtTime(0.3, now);
    const fireLfoGain = this.ctx.createGain();
    fireLfoGain.gain.setValueAtTime(0.12, now);

    fireLfo.connect(fireLfoGain);
    fireLfoGain.connect(hearthGain.gain);
    fireLfo.start(now);

    hearthBed.connect(hearthFilter);
    hearthFilter.connect(hearthGain);
    hearthGain.connect(this.ambientGain);
    hearthBed.start(now);

    this.ambientNodes.push(hearthBed, hearthFilter, hearthGain, fireLfo, fireLfoGain);

    // Layer B: Crepitio organico naturale (legna secca)
    const crackleInterval = setInterval(() => {
      if (this.ambientTrack !== 'fireplace' || !this.ctx) {
        clearInterval(crackleInterval);
        return;
      }
      if (Math.random() > 0.45) {
        this.triggerCozyFireCrackle();
      }
    }, 220);

    this.ambientNodes.push({ stop: () => clearInterval(crackleInterval) });
  }

  triggerCozyFireCrackle() {
    if (!this.ctx || !this.whiteNoiseBuffer) return;
    const now = this.ctx.currentTime;
    const pop = this.ctx.createBufferSource();
    pop.buffer = this.whiteNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800 + Math.random() * 1400, now);
    filter.Q.setValueAtTime(6, now);

    const gain = this.ctx.createGain();
    const vol = 0.08 + Math.random() * 0.16;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02 + Math.random() * 0.02);

    pop.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    pop.start(now);
    pop.stop(now + 0.05);
  }

  /**
   * 3. ONDE ALPHA & FLUSSO CREATIVO (432Hz)
   * Tappeto armonico binaurale rilassante studiato per la concentrazione narrativa profonda.
   * Accordo caldo a frequenze auree con modulazione vellutata.
   */
  buildAlphaWavesAmbiance() {
    const now = this.ctx.currentTime;
    const freqs = [108, 216, 324, 432]; // Armoniche pure di 432Hz

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq + (idx === 0 ? 0 : (Math.random() * 0.4 - 0.2)), now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, now);

      // Volume decrescente per armoniche superiori
      const targetGain = 0.07 / (idx + 1);
      gain.gain.setValueAtTime(targetGain, now);

      // Tremolo/LFO delicatissimo a frequenza Alpha (8-10Hz diviso a onda lenta)
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08 + idx * 0.02, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(targetGain * 0.35, now);

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start(now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain);

      osc.start(now);
      this.ambientNodes.push(osc, filter, gain, lfo, lfoGain);
    });
  }

  /**
   * 4. VENTO D'AUTUNNO E RIFUGIO
   * Fruscio soffice del vento che accarezza i vetri mentre si è al caldo.
   */
  buildAutumnWindAmbiance() {
    if (!this.pinkNoiseBuffer) return;
    const now = this.ctx.currentTime;

    const wind = this.ctx.createBufferSource();
    wind.buffer = this.pinkNoiseBuffer;
    wind.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(280, now);
    windFilter.Q.setValueAtTime(2.2, now);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.38, now);

    // LFO per simulare le brezze alternate
    const windLfo = this.ctx.createOscillator();
    windLfo.frequency.setValueAtTime(0.09, now);
    const windLfoGain = this.ctx.createGain();
    windLfoGain.gain.setValueAtTime(160, now);

    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start(now);

    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
    wind.start(now);

    this.ambientNodes.push(wind, windFilter, windGain, windLfo, windLfoGain);
  }

  /**
   * 5. CAFFÈ LETTERARIO VINTAGE
   * Atmosfera ovattata, calore acustico della stanza e morbido riverbero.
   */
  buildCafeAmbiance() {
    if (!this.pinkNoiseBuffer) return;
    const now = this.ctx.currentTime;

    const room = this.ctx.createBufferSource();
    room.buffer = this.pinkNoiseBuffer;
    room.loop = true;

    const roomFilter = this.ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.setValueAtTime(320, now);

    const roomGain = this.ctx.createGain();
    roomGain.gain.setValueAtTime(0.28, now);

    room.connect(roomFilter);
    roomFilter.connect(roomGain);
    roomGain.connect(this.ambientGain);
    room.start(now);

    this.ambientNodes.push(room, roomFilter, roomGain);

    // Micro rumori acustici occasionali felpati (tazza in porcellana lontana, pagine voltate)
    const cupInterval = setInterval(() => {
      if (this.ambientTrack !== 'cafe' || !this.ctx) {
        clearInterval(cupInterval);
        return;
      }
      if (Math.random() > 0.6) {
        this.triggerCozyCeramic();
      }
    }, 1800);

    this.ambientNodes.push({ stop: () => clearInterval(cupInterval) });
  }

  triggerCozyCeramic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const note = [1760, 2093, 2349, 2793][Math.floor(Math.random() * 4)];
    osc.frequency.setValueAtTime(note, now);

    gain.gain.setValueAtTime(0.012, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ambientGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * 6. CALORE ANALOGICO & VINILE LO-FI
   * Fruscio continuo caldo e morbido con micro-crepitii rilassanti
   */
  buildVinylWarmthAmbiance() {
    if (!this.pinkNoiseBuffer) return;
    const now = this.ctx.currentTime;

    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.pinkNoiseBuffer;
    hiss.loop = true;

    const hissFilter = this.ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(800, now);
    hissFilter.Q.setValueAtTime(1.2, now);

    const hissGain = this.ctx.createGain();
    hissGain.gain.setValueAtTime(0.22, now);

    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(this.ambientGain);
    hiss.start(now);

    this.ambientNodes.push(hiss, hissFilter, hissGain);

    const dustInterval = setInterval(() => {
      if (this.ambientTrack !== 'vinyl' || !this.ctx) {
        clearInterval(dustInterval);
        return;
      }
      if (Math.random() > 0.55) {
        this.triggerSoftDustTick();
      }
    }, 350);

    this.ambientNodes.push({ stop: () => clearInterval(dustInterval) });
  }

  triggerSoftDustTick() {
    if (!this.ctx || !this.whiteNoiseBuffer) return;
    const now = this.ctx.currentTime;
    const tick = this.ctx.createBufferSource();
    tick.buffer = this.whiteNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2800, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

    tick.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    tick.start(now);
    tick.stop(now + 0.015);
  }
}

export const audioEngine = new CozyAudioEngine();

