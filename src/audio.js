/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements a slow, warm, single-note bell style Brahms' Lullaby.
 * @version 1.5
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let reverbBus = null;
    let isInitialized = false;
    let isMuted = false;

    // Brahms' Lullaby Melody (Lowered to 4th/5th Octave)
    // Frequencies: G4: 392.00, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99
    const LULLABY_NOTES = [
        // "Lullaby and goodnight"
        { f: 392.00, d: 0.8 }, { f: 392.00, d: 0.8 }, { f: 523.25, d: 0.8 }, { f: 523.25, d: 0.8 }, { f: 523.25, d: 1.6 },
        { f: 659.25, d: 0.8 }, { f: 659.25, d: 0.8 }, { f: 783.99, d: 0.8 }, { f: 783.99, d: 0.8 }, { f: 783.99, d: 1.6 },
        
        // "With roses bedight"
        { f: 587.33, d: 0.8 }, { f: 587.33, d: 0.8 }, { f: 783.99, d: 0.8 }, { f: 783.99, d: 0.8 }, { f: 783.99, d: 1.6 },
        { f: 659.25, d: 0.8 }, { f: 659.25, d: 0.8 }, { f: 523.25, d: 0.8 }, { f: 523.25, d: 0.8 }, { f: 523.25, d: 1.6 },
        
        // "Go to sleep, little baby..." (Descending pattern)
        { f: 523.25, d: 0.8 }, { f: 523.25, d: 0.8 }, { f: 783.99, d: 1.6 },
        { f: 698.46, d: 0.8 }, { f: 659.25, d: 0.8 }, { f: 587.33, d: 0.8 }, { f: 523.25, d: 2.0 }
    ];

    /**
     * @brief Initializes the Web Audio context and graph.
     */
    async function init() {
        if (ctx && ctx.state === 'running') return true;

        try {
            if (!ctx) {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                
                masterGain = ctx.createGain();
                masterGain.gain.value = 0.25; 
                masterGain.connect(ctx.destination);

                // Simple Reverb-like tail without echo/delay
                reverbBus = ctx.createGain();
                reverbBus.gain.value = 0.3;
                reverbBus.connect(masterGain);
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
     * @brief Plays a single "warm bell" note with long sustain
     */
    function playNote(freq, startTime, duration) {
        if (!ctx || ctx.state !== 'running' || isMuted) return;

        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        // Warm pure sine wave
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Very slow attack (0.2s) for warmth, long release (4s) for sustain
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.2); 
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 4.0);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        noteGain.connect(reverbBus);

        osc.start(startTime);
        osc.stop(startTime + duration + 4.1);
    }

    let isPlaying = false;
    let sequenceTimeout = null;
    let nextNoteTime = 0;

    /**
     * @brief Starts the slow, single-note lullaby.
     */
    async function startLullaby() {
        const success = await init();
        if (!success || isPlaying) return;
        
        isPlaying = true;
        nextNoteTime = ctx.currentTime + 0.2;
        const tempo = 2.0; // Even slower (2.0s per beat)

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
            nextNoteTime += loopDuration + 4.0; // Long silence between loops
            sequenceTimeout = setTimeout(scheduleLoop, nextBatchWait + 4000);
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
            masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.25, ctx.currentTime, 0.2);
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
