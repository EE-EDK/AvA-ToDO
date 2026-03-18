# Procedural Audio Engine Protocol

> Production methodology for zero-asset Web Audio API synthesis in 3D worlds.
> Companion to: Generative WebGL Protocol v2

---

## I. Core Philosophy: Zero-Asset Procedural Audio

### Why Procedural

External audio files create loading bottlenecks, limit variation, and can't react to world state in real time. Procedural audio eliminates all three:

- **Zero loading** — No network requests, no asset pipeline, no CDN. Sounds synthesized on-the-fly from oscillators, noise buffers, and parameter automation.
- **Infinite variation** — Every sound instance is uniquely parameterized. No two creature calls, footsteps, or ambient textures are identical.
- **Reactive to world state** — Pitch, timbre, volume, and reverb can modulate continuously in response to player position, time of day, weather, proximity to entities, or any other game variable.

### The Web Audio API as a Modular Synthesizer

The Web Audio API provides a graph-based audio processing model analogous to a hardware modular synthesizer:

| Synth Module | Web Audio Node |
|-------------|----------------|
| VCO (oscillator) | `OscillatorNode` |
| VCF (filter) | `BiquadFilterNode` |
| VCA (amplifier) | `GainNode` |
| Noise generator | `AudioBufferSourceNode` with pre-generated noise buffer |
| Panner | `StereoPannerNode` |
| Delay / Reverb | `DelayNode` + `GainNode` feedback loops |
| Mixer | `GainNode` as bus, multiple inputs summed |

Nodes connect via `.connect()`. The browser's audio thread processes the graph at sample rate (typically 44,100 Hz). JavaScript only touches parameter automation — the actual DSP runs natively.

### AudioContext Lifecycle

```
User gesture (click/touch)
  → new AudioContext()
  → Build DSP graph (buses, reverb, pools)
  → ctx.resume() if suspended
  → Ready for synthesis
```

The AudioContext **must** be created or resumed inside a user gesture handler (browser autoplay policy). Design the init flow so the full DSP graph is built on first interaction, not on page load.

### The Guard Pattern

Every exported audio function must check initialization and mute state before doing work:

```javascript
export function playCreatureCall(type, params) {
  if (!initialized || muted) return;
  // ... synthesis logic
}
```

This prevents null reference errors during early frames (before user gesture) and respects the player's mute preference without requiring callers to check.

### Decoupling: Callback Injection

Entity and world code **never** import the audio module directly. Instead:

1. Audio module exports functions: `playFootstep()`, `playCreatureCall()`, etc.
2. Main module imports both audio functions and entity systems
3. Main passes audio functions as callbacks to entity systems during initialization

```javascript
// main.js
import { playCreatureCall } from './audio.js';
import { initCreatures } from './creatures.js';

initCreatures({ onCall: playCreatureCall });
```

This prevents circular dependencies, keeps entity modules testable in isolation, and allows audio to be swapped or disabled without touching entity code.

---

## II. The Managed Voice

### The Problem

Fire-and-forget voice creation (`createOscillator()` → `.start()` → `.stop()` → garbage collected) works well at low density. Each call allocates nodes on the heap. The browser's garbage collector reclaims them after `.stop()`. At fewer than ~15 simultaneous transient voices, GC pauses are imperceptible.

Above that threshold, rapid node creation/destruction causes:
- GC pressure spikes (stutters every 2-5 seconds)
- AudioNode accumulation if `.stop()` timing is imprecise
- Memory fragmentation over long sessions

### When Fire-and-Forget Is Fine

- Fewer than 15 simultaneous transient voices
- Sounds triggered at intervals > 100ms
- Session duration under 30 minutes
- Target audience on desktop hardware

### When You Need Pooling

- More than 15 simultaneous transients
- Rapid-fire triggers (< 100ms apart — e.g., particle sounds, impact clusters)
- Long sessions (> 1 hour)
- Mobile targets where GC pauses are more disruptive

### Voice Pool Design

Pre-allocate a fixed array of synthesis chains at init time. Keep them connected but silent (gain = 0). Assign to events dynamically.

**Standard synthesis chain:**
```
OscillatorNode → BiquadFilterNode → GainNode → StereoPannerNode → Bus GainNode
```

**Init procedure:**
1. Create `poolSize` chains (16 for mobile, 32 for desktop)
2. Start all oscillators immediately (they produce sound, but gain is 0)
3. Store chain references in an array with metadata: `{ osc, filter, gain, panner, state, startTime }`
4. All chains connect to a shared bus GainNode

**Assignment procedure:**
1. Find next voice with `state === 'idle'`
2. Configure: `osc.frequency.value`, `filter.frequency.value`, `filter.Q.value`, `panner.pan.value`
3. Ramp gain from 0 to target (attack phase)
4. Set `state = 'active'`, record `startTime`
5. Schedule release (gain ramp to 0, then set `state = 'idle'`)

**Never disconnect nodes.** Setting gain to 0 is functionally silent. The browser's audio thread skips processing for silent subgraphs on most implementations. Disconnecting and reconnecting causes click artifacts and forces graph recompilation.

### Persistent vs Transient Voices

| Type | Examples | Lifecycle | Pool? |
|------|----------|-----------|-------|
| **Persistent** | Forest ambience, wind, rain, water, continuous drones | Created once, gain-modulated per frame | No — always connected |
| **Transient** | Creature calls, footsteps, impacts, musical notes, UI sounds | Short-lived (0.1s - 4s) | Yes — from voice pool |

Persistent voices are exempt from pooling and voice stealing. They have dedicated nodes outside the pool, modulated directly each frame.

---

## III. Scheduling Strategies

### Strategy A: Game-Loop Direct (Recommended for Real-Time 3D)

Trigger sounds from `requestAnimationFrame` or the game update loop. Use `AudioContext.currentTime` for sample-accurate start times within the current frame.

```javascript
function gameLoop(dt) {
  // ... game logic ...
  if (shouldPlaySound) {
    const now = ctx.currentTime;
    voice.gain.setValueAtTime(0, now);
    voice.gain.linearRampToValueAtTime(0.05, now + 0.01);
    // ... configure and schedule
  }
}
```

**Pros:** Zero latency between game event and sound. Natural integration with game state — sounds are triggered in the same context that detects them.

**Cons:** Sounds can only fire on frame boundaries (~16ms granularity at 60fps, ~50ms at 20fps). Fine for ambience and effects, imprecise for rhythmic music.

### Strategy B: Lookahead Scheduler (For Music / Sequenced Audio)

A `setInterval(25ms)` timer runs independently of the render loop. Each tick scans an event queue for events within a 100ms lookahead window. Events found are scheduled on the hardware audio clock.

```javascript
const LOOKAHEAD = 0.1;    // 100ms
const INTERVAL = 0.025;   // 25ms

setInterval(() => {
  const now = ctx.currentTime;
  while (nextEventTime < now + LOOKAHEAD) {
    scheduleEvent(nextEvent, nextEventTime);
    advanceToNextEvent();
  }
}, INTERVAL * 1000);
```

**Pros:** Sub-millisecond timing precision. Events are committed to the hardware clock ahead of time, immune to main-thread jank. Cancelable before the lookahead window closes.

**Cons:** 100ms commit window means events scheduled more than ~100ms in the future are still queue-resident and subject to modification, but once committed they can't be changed. Adds architectural complexity.

### Strategy C: Hybrid

Use Strategy A for game-triggered sounds (immediate response to player actions, entity proximity, environmental changes) and Strategy B for music sequencing and rhythmic patterns.

### Decision Matrix

| Sound Type | Strategy | Rationale |
|-----------|----------|-----------|
| Footsteps, impacts | A | Must sync with visual frame |
| Creature calls | A | Triggered by proximity/AI, frame-accurate is sufficient |
| Ambient layers | A | Continuous modulation per frame |
| Melodic sequences | B | Timing precision matters for musical perception |
| Rhythmic patterns | B | Jank-proof scheduling |
| Everything in a small project | A | Simpler, fewer moving parts |

---

## IV. Signal Flow & Bus Architecture

### Graph Topology

```
                          ┌─ Ambient Bus ────┐
                          │                  │
Persistent Voices ────────┤                  ├──→ Master Gain → Destination
                          │                  │         ↑
Transient Pool ───────────┼─ Entity Bus ─────┤         │
                          │                  │    Reverb Send
Music Voices ─────────────┼─ Music Bus ──────┤    (shared effect)
                          │                  │
Interaction Voices ───────┼─ Interaction Bus ┘
                          │
                          └─→ Reverb Input → Delay Network → Reverb Bus → Master
```

### Category Buses

Each bus is a `GainNode` with independent volume control:

| Bus | Purpose | Typical Gain |
|-----|---------|-------------|
| **Ambient** | Environmental layers: noise, weather, biome atmosphere | 0.3 - 0.6 |
| **Entity** | AI-driven entity sounds: creature calls, movement, reactions | 0.4 - 0.8 |
| **Music** | Generative composition: melodic instruments, harmonic drones | 0.2 - 0.5 |
| **Interaction** | Player-triggered: footsteps, impacts, UI feedback | 0.5 - 1.0 |

### Shared Reverb: Dual-Delay Feedback Network

A convincing reverb can be built from two cross-fed delay lines:

```javascript
const delay1 = ctx.createDelay(1.0);
const delay2 = ctx.createDelay(1.0);
const fb1 = ctx.createGain();
const fb2 = ctx.createGain();
const lpf = ctx.createBiquadFilter();  // Darkens tail
const hpf = ctx.createBiquadFilter();  // Prevents rumble

delay1.delayTime.value = 0.55;   // Irrational ratio to delay2
delay2.delayTime.value = 0.79;
fb1.gain.value = 0.35;
fb2.gain.value = 0.30;
lpf.type = 'lowpass';  lpf.frequency.value = 2500;
hpf.type = 'highpass'; hpf.frequency.value = 200;

// Cross-feed: delay1 → fb1 → hpf → delay2 → fb2 → lpf → delay1
delay1.connect(fb1).connect(hpf).connect(delay2);
delay2.connect(fb2).connect(lpf).connect(delay1);
// Output tap
delay1.connect(reverbBus);
delay2.connect(reverbBus);
```

**Why irrational delay times:** If delay times share a common factor, their feedback patterns align periodically, creating audible comb filtering. Choosing near-irrational ratios (0.55 and 0.79 — LCM alignment at ~43s) produces a dense, non-repeating tail that simulates natural room reflections.

**Highpass in feedback:** Without it, low-frequency energy accumulates across feedback iterations, producing rumble. A 200 Hz cutoff keeps the tail clean.

**Lowpass in delay path:** Natural reverberation loses high frequencies with each reflection (absorbed by surfaces). A 2500 Hz lowpass darkens the tail progressively, mimicking this natural rolloff.

### The connectWithReverb Pattern

A utility function that routes a voice to both its dry bus and the shared reverb send in a single call:

```javascript
function connectWithReverb(sourceGain, dryBus, wetAmount) {
  sourceGain.connect(dryBus);              // Dry path
  const wet = ctx.createGain();
  wet.gain.value = wetAmount;              // 0.0 - 0.4 typical
  sourceGain.connect(wet).connect(reverbInput);  // Wet path
}
```

---

## V. Anti-Clicking Protocol

### The Problem

Audio clicks and pops occur when a signal's value changes discontinuously. In Web Audio, this happens when:
- A gain jumps from one value to another without a ramp
- An oscillator starts or stops abruptly
- Parameter automation doesn't anchor from the current value

### The Anchor Rule

**ALWAYS** call `setValueAtTime(currentValue, now)` before any ramp automation:

```javascript
// WRONG — starts ramp from unknown state, may click
gain.linearRampToValueAtTime(0.05, now + 0.01);

// RIGHT — anchors at current value, then ramps smoothly
gain.setValueAtTime(gain.value, now);
gain.linearRampToValueAtTime(0.05, now + 0.01);
```

Without the anchor, the automation system doesn't know where to ramp FROM. It may interpolate from a stale scheduled value, causing a discontinuity.

### ADSR Envelope Pattern

```javascript
function applyEnvelope(gain, { attack, decay, sustain, release, peak }) {
  const now = ctx.currentTime;

  // Anchor
  gain.setValueAtTime(0, now);

  // Attack: silence → peak
  gain.linearRampToValueAtTime(peak, now + attack);

  // Decay: peak → sustain level
  gain.exponentialRampToValueAtTime(
    Math.max(sustain * peak, 0.001),  // exponential can't target 0
    now + attack + decay
  );

  // Sustain: hold at sustain level (no automation needed)

  // Release: schedule for later
  // setTargetAtTime provides exponential decay toward 0
  // timeConstant = release/3 reaches ~5% of sustain in `release` seconds
  setTimeout(() => {
    gain.setTargetAtTime(0.001, ctx.currentTime, release / 3);
  }, (attack + decay + sustainDuration) * 1000);
}
```

**Why `setTargetAtTime` for release:** It produces an exponential decay that mimics natural acoustic damping and is guaranteed to approach silence. Unlike `exponentialRampToValueAtTime`, it doesn't require knowing the exact current value — it decays from wherever the signal is.

### Voice Recycling Safety

After scheduling release, mark the voice as `'releasing'`. Only transition to `'idle'` when the gain has fallen below a threshold:

```javascript
if (voice.state === 'releasing' && voice.gain.value < 0.001) {
  voice.state = 'idle';
}
```

This prevents reassignment while the voice is still audibly fading out.

### Crossfade Overlaps

When transitioning between ambient layers (e.g., forest → cave), overlap the outgoing and incoming layers by 30-50ms minimum. Shorter overlaps produce a perceptible gap; longer overlaps waste polyphony.

---

## VI. Voice Stealing & Polyphony

### Hard Polyphony Cap

Define a maximum simultaneous voice count based on target platform:

| Platform | Max Voices | Rationale |
|----------|-----------|-----------|
| Desktop (modern) | 32 | Headroom for complex scenes |
| Desktop (minimum) | 24 | Conservative for older hardware |
| Mobile | 16 | Battery + thermal constraints |

### Stealing Priority

When the pool is full and a new sound must play:

1. **Releasing voices first** — These are already fading out. Stealing them is nearly inaudible.
2. **Oldest Active voice** — If no Releasing voices exist, steal the voice that has been active longest (it's likely the least perceptually important).
3. **Never steal Persistent voices** — Ambient layers are exempt from the pool entirely.

### Stolen Voice Procedure

```javascript
function stealVoice(voice) {
  const now = ctx.currentTime;

  // 1. Cancel any pending automation
  voice.gain.cancelScheduledValues(now);

  // 2. Anchor at current value (prevents click)
  voice.gain.setValueAtTime(voice.gain.value, now);

  // 3. Emergency fadeout — 5ms is fast enough to be imperceptible
  voice.gain.linearRampToValueAtTime(0, now + 0.005);

  // 4. After fadeout, reconfigure for new sound
  setTimeout(() => {
    configureVoice(voice, newParams);
    voice.state = 'active';
  }, 6); // slightly longer than 5ms to ensure fadeout completed
}
```

The 5ms emergency fadeout is a critical parameter. Shorter durations may click on some hardware. Longer durations introduce audible latency when new sounds are urgent.

---

## VII. Noise Buffer Design

### Pre-Generate at Init

Create typed `Float32Array` buffers once during initialization, not per-sound. Noise generation is CPU-intensive; doing it per-sound causes frame drops.

```javascript
function generateBrownNoise(sampleRate, durationSeconds) {
  const length = sampleRate * durationSeconds;
  const buffer = new Float32Array(length);
  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;  // Leaky integrator
    buffer[i] = lastOut * 3.5;  // Normalize
  }
  return buffer;
}
```

### Co-Prime Buffer Lengths

If multiple noise sources loop simultaneously with the same buffer length, their patterns align every loop cycle, creating an audible repetition point.

Use co-prime durations:

| Buffer | Duration | Samples (44.1kHz) |
|--------|----------|-------------------|
| Brown noise (wind) | 16s | 705,600 |
| White noise (rain) | 11s | 485,100 |
| Pink noise (ambience) | 9s | 396,900 |

**LCM = 1,584s (~26 minutes)** before all three buffers align simultaneously. For practical purposes, the combined texture never repeats.

### Buffer Reuse

A single `AudioBuffer` can be shared by multiple `AudioBufferSourceNode` instances. Create one buffer per noise type, then create new source nodes pointing to the same buffer data. This avoids duplicating the sample data in memory.

---

## VIII. Spatial Audio for 3D Worlds

### Distance Falloff

For positioned sounds in a 3D environment, calculate volume based on distance:

```javascript
function getDistanceVolume(soundX, soundZ, listenerX, listenerZ, maxDist, baseVol) {
  const dx = soundX - listenerX;
  const dz = soundZ - listenerZ;
  const d2 = dx * dx + dz * dz;
  const maxDist2 = maxDist * maxDist;

  // Early exit — squared distance check, no sqrt
  if (d2 > maxDist2) return 0;

  // Linear falloff (sqrt only when within range)
  const d = Math.sqrt(d2);
  return Math.max(0, 1.0 - d / maxDist) * baseVol;
}
```

**Squared distance for culling:** Always check `d2 > maxDist2` before computing `Math.sqrt()`. The square root is only needed for volume calculation, and most sounds will be outside hearing range on any given frame.

### Stereo Panning

Use `StereoPannerNode` for left/right placement based on the angle between the listener's forward direction and the sound source:

```javascript
function getSteroPan(soundX, soundZ, listenerX, listenerZ, listenerYaw) {
  const angle = Math.atan2(soundX - listenerX, soundZ - listenerZ);
  const relative = angle - listenerYaw;
  return Math.sin(relative);  // -1 (left) to +1 (right)
}
```

### Zone-Based Ambient Modulation

Rather than computing spatialization per-ambient-source (expensive and unnecessary for environmental layers), modulate ambient bus volumes based on player zone:

- Near water → boost water ambience gain, reduce forest gain
- On ridgeline → boost wind gain
- In dense forest → boost insect/creature gains
- Near crystals → boost resonance drone

Use the same squared-distance proximity checks used for entity culling.

### Proximity Triggers with Cooldowns

Dense entity clusters can trigger dozens of sounds per frame if unchecked. Implement per-type cooldowns:

```javascript
const cooldowns = {};  // { 'creature_frog': 4.0, 'creature_cricket': 8.0, ... }
const lastPlayed = {};

function canPlay(type) {
  const now = performance.now() / 1000;
  const cd = cooldowns[type] || 2.0;
  if (now - (lastPlayed[type] || 0) < cd) return false;
  lastPlayed[type] = now;
  return true;
}
```

---

## IX. Generative Music Integration

### Harmonic Field

Choose a musical scale where any combination of simultaneous notes produces consonance. This allows multiple independent music voices to play without coordination:

| Scale | Notes | Clashes? | Best For |
|-------|-------|----------|----------|
| Major Pentatonic | C D E G A | None | Safe ambient music |
| Minor Pentatonic | A C D E G | None | Darker moods |
| Whole Tone | C D E F# G# A# | Dissonant by nature | Dreamlike/ethereal |
| Dorian | D E F G A B C | Minor 2nd (E-F) | Balanced tension |

**Major Pentatonic** is the safest choice for ambient generative music — no semitone intervals means no dissonance regardless of which notes sound simultaneously.

### Chord Progression

Cycle through 3-4 chords on a slow timer. Each chord defines a subset of the scale that instruments favor:

```javascript
const chords = [
  { root: 'C', notes: [261.6, 329.6, 392.0] },  // C major
  { root: 'Am', notes: [220.0, 261.6, 329.6] },  // A minor
  { root: 'F', notes: [349.2, 440.0, 261.6] },   // F major
  { root: 'G', notes: [392.0, 493.9, 293.7] },   // G major
];
let chordIndex = 0;
let chordTimer = 0;
const CHORD_DURATION = 16; // seconds

function updateChord(dt) {
  chordTimer += dt;
  if (chordTimer > CHORD_DURATION) {
    chordTimer = 0;
    chordIndex = (chordIndex + 1) % chords.length;
  }
}
```

### Instrument Layering

Spawn instrument voices on independent timers with random jitter to prevent mechanical regularity:

```javascript
const instruments = [
  { name: 'harp', baseInterval: 3.0, jitter: 1.5 },
  { name: 'pad', baseInterval: 8.0, jitter: 3.0 },
  { name: 'bell', baseInterval: 5.0, jitter: 2.0 },
];

instruments.forEach(inst => {
  inst.timer = inst.baseInterval * Math.random(); // Stagger start
});

function updateMusic(dt) {
  instruments.forEach(inst => {
    inst.timer -= dt;
    if (inst.timer <= 0) {
      playInstrumentNote(inst.name, currentChord);
      inst.timer = inst.baseInterval + (Math.random() - 0.5) * inst.jitter;
    }
  });
}
```

### Reactive Density

World state modulates how frequently instruments play and how many are active:

| World State | Density | Active Instruments |
|------------|---------|-------------------|
| Idle/calm | Sparse | Harp + drone only |
| Exploring | Moderate | + pad, occasional bell |
| Near magic | Dense | All instruments, shorter intervals |
| Climax/event | Maximum | Rapid notes, additional octaves |

### Reverb Cohesion

Route all music voices through the shared reverb to place them in the same acoustic space. Without reverb, simultaneously playing instruments sound disconnected. With it, they fuse into a cohesive soundscape.

---

## X. State-Reactive Audio (Progressive Soundscapes)

### Gate Layers Behind Progression

As the player progresses through the world (collecting items, visiting areas, completing objectives), unlock new audio layers. This creates a sense of the world sonically evolving in response to the player's actions.

### Layer Activation Protocol

Each new layer follows the anti-clicking protocol for smooth introduction:

```javascript
function activateLayer(layerGain, targetVolume, fadeSeconds) {
  const now = ctx.currentTime;
  layerGain.gain.setValueAtTime(0, now);
  layerGain.gain.linearRampToValueAtTime(targetVolume, now + fadeSeconds);
}
```

### Example Progression

| Milestone | Audio Change |
|-----------|-------------|
| Start (0 objectives) | Baseline ambient only (wind, insects) |
| First discovery | + resonance drone layer |
| 2 discoveries | + creature call frequency doubles |
| 3 discoveries | + harmonic undertone layer |
| 4 discoveries | + full creature chorus, entity sounds gain harmonics |
| All discoveries | + complete harmonic orchestra, all layers at full density |

### Entity Sound Modulation

Beyond adding new layers, existing sounds evolve:
- **Cooldowns halve** — creatures vocalize twice as often
- **Harmonics added** — creature calls gain octave doublings
- **Reverb send increases** — sounds feel more spacious and connected
- **Volume ceilings rise** — the world gets louder as it "awakens"

---

## XI. Performance Budget

### Targets

| Metric | Budget | Rationale |
|--------|--------|-----------|
| Frame impact | < 1ms per frame | Audio processing must not cause frame drops |
| Max oscillators | 40-50 | Browser-dependent; Safari is most constrained |
| Noise buffers | ~4MB total | 3 buffers × ~1.3MB each (16s × 44.1kHz × 4 bytes) |
| Voice pool | 16-32 chains | Pre-allocated, zero runtime allocation |
| GC pressure | Zero in hot path | Node reuse, pre-allocated buffers, no per-frame allocations |

### Node Reuse vs Creation

| Operation | Cost |
|-----------|------|
| `createOscillator()` + `.start()` | ~0.1ms + heap allocation |
| Reconfigure existing node parameters | ~0.005ms, zero allocation |

Node reuse is ~20x faster and produces zero garbage. Over a 60-minute session with 1000+ transient sounds, the difference between "create/destroy" and "reuse" is measurable in both GC pause frequency and memory stability.

### Profiling

Use `AudioContext.getOutputTimestamp()` to detect audio clock drift relative to the system clock. If drift exceeds 10ms, the audio thread may be overloaded:

```javascript
function checkAudioHealth() {
  const { contextTime, performanceTime } = ctx.getOutputTimestamp();
  const systemTime = performance.now() / 1000;
  const drift = Math.abs(systemTime - performanceTime);
  if (drift > 0.01) {
    console.warn('Audio thread drift:', drift.toFixed(4), 's');
  }
}
```

### Mobile Considerations

| Adjustment | Desktop | Mobile |
|-----------|---------|--------|
| Pool size | 32 | 16 |
| Noise buffer duration | 16s | 8s |
| Reverb | Full dual-delay | Single delay or skip |
| Max simultaneous oscillators | 50 | 24 |
| Ambient layers | All | Core subset only |

---

## XII. Implementation Checklist

- [ ] AudioContext created on first user gesture (click/touch handler)
- [ ] Guard pattern on every exported audio function (`if (!initialized || muted) return`)
- [ ] Master gain with global mute toggle
- [ ] Category buses wired (ambient, entity, music, interaction)
- [ ] Noise buffers pre-generated at init (brown, white; co-prime lengths)
- [ ] Shared reverb built (dual-delay, irrational times, feedback filters)
- [ ] Persistent ambient voices connected and gain-modulated per frame
- [ ] Transient voice pool allocated (16-32 synthesis chains, warmed, gains at 0)
- [ ] Voice assignment: find idle → configure → ramp in → track state
- [ ] Voice stealing active with polyphony cap (releasing first, then oldest active)
- [ ] Anti-clicking: all ramps anchored with `setValueAtTime` before any ramp call
- [ ] ADSR envelope utility with `setTargetAtTime` for release
- [ ] Spatial panning via `StereoPannerNode` based on listener heading
- [ ] Distance falloff with squared-distance culling (no sqrt in hot path)
- [ ] Cooldown system prevents sound spam per entity type
- [ ] Music system: harmonic field (pentatonic), chord progression timer, instrument layers with jitter
- [ ] State-reactive gating: audio layers unlock with game progression milestones
- [ ] Callback injection: no direct audio imports from entity/world code
- [ ] Performance profiling: `getOutputTimestamp()` drift check
- [ ] Mobile fallbacks: reduced pool, shorter buffers, simplified reverb
