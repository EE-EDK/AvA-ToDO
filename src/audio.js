/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements a low, warm violin/string style Brahms' Lullaby.
 * @version 1.6
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let isInitialized = false;
    let isMuted = false;

    // Brahms' Lullaby Melody (Lowered to 3rd/4th Octave - String Range)
    // Frequencies: G3: 196.00, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00
    const LULLABY_NOTES = [
        // "Lullaby and goodnight"
        { f: 196.00, d: 0.8 }, { f: 196.00, d: 0.8 }, { f: 261.63, d: 0.8 }, { f: 261.63, d: 0.8 }, { f: 261.63, d: 1.6 },
        { f: 329.63, d: 0.8 }, { f: 329.63, d: 0.8 }, { f: 392.00, d: 0.8 }, { f: 392.00, d: 0.8 }, { f: 392.00, d: 1.6 },
        
        // "With roses bedight"
        { f: 293.66, d: 0.8 }, { f: 293.66, d: 0.8 }, { f: 392.00, d: 0.8 }, { f: 392.00, d: 0.8 }, { f: 392.00, d: 1.6 },
        { f: 329.63, d: 0.8 }, { f: 329.63, d: 0.8 }, { f: 261.63, d: 0.8 }, { f: 261.63, d: 0.8 }, { f: 261.63, d: 1.6 },
        
        // "Go to sleep, little baby..."
        { f: 261.63, d: 0.8 }, { f: 261.63, d: 0.8 }, { f: 392.00, d: 1.6 },
        { f: 349.23, d: 0.8 }, { f: 329.63, d: 0.8 }, { f: 293.66, d: 0.8 }, { f: 261.63, d: 2.0 }
    ];

    /**
     * @brief Initializes the Web Audio context.
     */
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

    /**
     * @brief Plays a single note with a violin-like timbre
     */
    function playNote(freq, startTime, duration) {
        if (!ctx || ctx.state !== 'running' || isMuted) return;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const noteGain = ctx.createGain();
        
        // Vibrato setup
        const vibrato = ctx.createOscillator();
        const vibratoGain = ctx.createGain();
        vibrato.frequency.value = 5; // 5Hz vibrato speed
        vibratoGain.gain.value = freq * 0.01; // Vibrato depth relative to frequency
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);

        // String Timbre: Sawtooth + Low Pass Filter
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, startTime); // Warm cutoff
        filter.Q.value = 1;

        // Bowed envelope: Gentle attack (0.4s), long release
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.4); 
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 3.0);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(startTime);
        vibrato.start(startTime);
        
        osc.stop(startTime + duration + 3.1);
        vibrato.stop(startTime + duration + 3.1);
    }

    let isPlaying = false;
    let sequenceTimeout = null;
    let nextNoteTime = 0;

    async function startLullaby() {
        const success = await init();
        if (!success || isPlaying) return;
        
        isPlaying = true;
        nextNoteTime = ctx.currentTime + 0.2;
        const tempo = 2.2; // Slow and steady

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
                playNote(note.f, nextNoteTime + loopDuration, note.d * tempo);
                loopDuration += note.d * tempo;
            });

            const nextBatchWait = (loopDuration) * 1000;
            nextNoteTime += loopDuration + 5.0; // Significant pause between refrains
            sequenceTimeout = setTimeout(scheduleLoop, nextBatchWait + 5000);
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
