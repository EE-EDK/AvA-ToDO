/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements an accurate, warm low-string version of Brahms' Lullaby.
 * @version 2.0
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let isInitialized = false;
    let isMuted = false;

    /**
     * Brahms' Lullaby - Definitive Melody
     * Durations (d): 1.0 = Quarter, 2.0 = Half, 3.0 = Dotted Half, 0.5 = Eighth
     * Frequencies (4th/5th Octave):
     * C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25
     */
    const LULLABY_NOTES = [
        // Pickup: "Lul-la-"
        { f: 329.63, d: 0.5 }, { f: 329.63, d: 0.5 }, 
        // M1: "by and"
        { f: 392.00, d: 2.0 }, { f: 329.63, d: 0.5 }, { f: 329.63, d: 0.5 },
        // M2: "good night,"
        { f: 392.00, d: 2.0 }, { f: 329.63, d: 0.5 }, { f: 392.00, d: 0.5 },
        // M3: "With"
        { f: 523.25, d: 2.0 }, { f: 493.88, d: 1.0 },
        // M4: "ro-ses"
        { f: 440.00, d: 2.0 }, { f: 440.00, d: 1.0 },
        // M5: "be-"
        { f: 392.00, d: 2.0 }, { f: 293.66, d: 0.5 }, { f: 329.63, d: 0.5 },
        // M6: "dight,"
        { f: 349.23, d: 2.0 }, { f: 293.66, d: 0.5 }, { f: 329.63, d: 0.5 },
        // M7: "With"
        { f: 349.23, d: 2.0 }, { f: 293.66, d: 0.5 }, { f: 349.23, d: 0.5 },
        // M8: "li-"
        { f: 493.88, d: 2.0 }, { f: 440.00, d: 1.0 },
        // M9: "lies"
        { f: 392.00, d: 2.0 }, { f: 329.63, d: 1.0 },
        // M10: "o'er-"
        { f: 392.00, d: 2.0 }, { f: 261.63, d: 0.5 }, { f: 261.63, d: 0.5 },
        // M11: "spread"
        { f: 523.25, d: 2.0 }, { f: 440.00, d: 1.0 },
        // M12: "Is"
        { f: 349.23, d: 2.0 }, { f: 392.00, d: 1.0 },
        // M13: "ba-"
        { f: 329.63, d: 2.0 }, { f: 293.66, d: 1.0 },
        // M14: "by's sweet"
        { f: 261.63, d: 2.0 }, { f: 261.63, d: 0.5 }, { f: 261.63, d: 0.5 },
        // M15: "head."
        { f: 523.25, d: 2.0 }, { f: 440.00, d: 1.0 },
        // M16: "Lay"
        { f: 349.23, d: 2.0 }, { f: 392.00, d: 1.0 },
        // M17: "thee"
        { f: 329.63, d: 2.0 }, { f: 293.66, d: 1.0 },
        // M18: "down."
        { f: 261.63, d: 3.0 }
    ];

    async function init() {
        if (ctx && ctx.state === 'running') return true;

        try {
            if (!ctx) {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                masterGain = ctx.createGain();
                masterGain.gain.value = 0.2; 
                masterGain.connect(ctx.destination);
            }

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            isInitialized = (ctx.state === 'running');
            return isInitialized;
        } catch (e) {
            console.error('Audio Engine Init Failed:', e);
            return false;
        }
    }

    function playNote(freq, startTime, duration) {
        if (!ctx || ctx.state !== 'running' || isMuted) return;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const noteGain = ctx.createGain();
        
        // Vibrato (Acoustic character)
        const vibrato = ctx.createOscillator();
        const vibratoGain = ctx.createGain();
        vibrato.frequency.value = 4.5; // Slightly slower vibrato
        vibratoGain.gain.value = freq * 0.008; 
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);

        // Warm Violin Timbre
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, startTime); // Dark, woody tone
        filter.Q.value = 0.8;

        // Bowed Dynamics: Smooth attack, long release
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.4); 
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 2.5);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(startTime);
        vibrato.start(startTime);
        
        osc.stop(startTime + duration + 2.6);
        vibrato.stop(startTime + duration + 2.6);
    }

    let isPlaying = false;
    let sequenceTimeout = null;
    let nextNoteTime = 0;

    async function startLullaby() {
        const success = await init();
        if (!success || isPlaying) return;
        
        isPlaying = true;
        nextNoteTime = ctx.currentTime + 0.2;
        const beatDuration = 1.4; // Waltz tempo

        function scheduleLoop() {
            if (!isPlaying || ctx.state !== 'running') {
                isPlaying = false;
                return;
            }

            if (nextNoteTime < ctx.currentTime) {
                nextNoteTime = ctx.currentTime + 0.2;
            }

            let loopDuration = 0;
            LULLABY_NOTES.forEach(note => {
                playNote(note.f, nextNoteTime + loopDuration, note.d * beatDuration);
                loopDuration += note.d * beatDuration;
            });

            // Silence between loops
            const pause = 6.0;
            const nextBatchWait = (loopDuration) * 1000;
            nextNoteTime += loopDuration + pause;
            sequenceTimeout = setTimeout(scheduleLoop, nextBatchWait + (pause * 1000));
        }

        scheduleLoop();
    }

    function stopLullaby() {
        isPlaying = false;
        if (sequenceTimeout) clearTimeout(sequenceTimeout);
    }

    function toggleMute() {
        isMuted = !isMuted;
        if (masterGain && ctx) {
            masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.2, ctx.currentTime, 0.3);
        }
        return isMuted;
    }

    return {
        init,
        startLullaby,
        stopLullaby,
        toggleMute,
        isMuted: () => isMuted
    };
})();

window.AudioEngine = AudioEngine;
