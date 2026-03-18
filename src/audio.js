/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements a slow, warm bell style Brahms' Lullaby.
 * @version 1.2
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let reverbBus = null;
    let isInitialized = false;
    let isMuted = false;

    // Brahms' Lullaby Melody (Notes and Durations)
    // d: 1.0 = one full beat in our slow tempo
    const LULLABY_NOTES = [
        { f: 329.63, d: 1.0 }, { f: 329.63, d: 1.5 }, { f: 392.00, d: 0.5 }, // E4, E4, G4
        { f: 329.63, d: 1.0 }, { f: 329.63, d: 1.5 }, { f: 392.00, d: 0.5 }, // E4, E4, G4
        { f: 329.63, d: 1.0 }, { f: 392.00, d: 1.0 }, { f: 523.25, d: 2.0 }, // E4, G4, C5
        { f: 493.88, d: 1.0 }, { f: 440.00, d: 1.0 }, { f: 392.00, d: 2.0 }, // B4, A4, G4
        { f: 293.66, d: 1.0 }, { f: 349.23, d: 1.0 }, { f: 440.00, d: 2.0 }, // D4, F4, A4
        { f: 392.00, d: 1.0 }, { f: 349.23, d: 1.0 }, { f: 329.63, d: 2.0 }  // G4, F4, E4
    ];

    /**
     * @brief Initializes the Web Audio context and graph.
     */
    async function init() {
        if (isInitialized && ctx.state === 'running') return;

        try {
            if (!ctx) {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                
                masterGain = ctx.createGain();
                masterGain.gain.value = 0.25; // Lower overall volume for calming effect
                masterGain.connect(ctx.destination);

                // Reverb: Single long tail, no short echoes
                reverbBus = ctx.createGain();
                reverbBus.gain.value = 0.4; // More reverb for "ethereal" feel
                
                const delay = ctx.createDelay();
                delay.delayTime.value = 0.8; // Long delay time
                const feedback = ctx.createGain();
                feedback.gain.value = 0.2; // Low feedback to prevent "double sound" clutter

                reverbBus.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(masterGain);
            }

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            isInitialized = true;
            console.log('Audio Engine Initialized (v1.2). State:', ctx.state);
        } catch (e) {
            console.error('Web Audio API Initialization Error:', e);
        }
    }

    /**
     * @brief Plays a single "warm bell" note with long sustain
     */
    function playNote(freq, startTime, duration) {
        if (!isInitialized || isMuted) return;

        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        // Warm timbre: Sine wave is purest
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Slow attack (prevents clicks) and very long release
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.3, startTime + 0.1); 
        // Sustain note for longer than its musical duration
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 3.0);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        noteGain.connect(reverbBus);

        osc.start(startTime);
        osc.stop(startTime + duration + 3.1);
    }

    let isPlaying = false;
    let sequenceTimeout = null;
    let nextNoteTime = 0;

    /**
     * @brief Starts the slow, single-note lullaby.
     */
    async function startLullaby() {
        await init();
        if (isPlaying) return;
        
        isPlaying = true;
        nextNoteTime = ctx.currentTime + 0.2;
        const tempo = 1.8; // Much slower (1.8 seconds per beat)

        function scheduleLoop() {
            if (!isPlaying) return;

            if (nextNoteTime < ctx.currentTime) {
                nextNoteTime = ctx.currentTime + 0.2;
            }

            let loopDuration = 0;
            LULLABY_NOTES.forEach(note => {
                playNote(note.f, nextNoteTime + loopDuration, note.d * tempo);
                loopDuration += note.d * tempo;
            });

            // Schedule the next block with a slight gap
            const nextBatchWait = (loopDuration) * 1000;
            nextNoteTime += loopDuration + 2.0; // Added a 2 second gap between loops
            sequenceTimeout = setTimeout(scheduleLoop, nextBatchWait + 2000);
        }

        scheduleLoop();
    }

    function stopLullaby() {
        isPlaying = false;
        if (sequenceTimeout) clearTimeout(sequenceTimeout);
    }

    function toggleMute() {
        isMuted = !isMuted;
        if (masterGain) {
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
