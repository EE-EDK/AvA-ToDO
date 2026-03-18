/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements a music box style Brahms' Lullaby.
 * @version 1.1
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let reverbBus = null;
    let isInitialized = false;
    let isMuted = false;

    // Brahms' Lullaby Melody (Notes and Durations)
    const LULLABY_NOTES = [
        { f: 329.63, d: 0.5 }, { f: 329.63, d: 0.75 }, { f: 392.00, d: 0.25 }, // E4, E4, G4
        { f: 329.63, d: 0.5 }, { f: 329.63, d: 0.75 }, { f: 392.00, d: 0.25 }, // E4, E4, G4
        { f: 329.63, d: 0.5 }, { f: 392.00, d: 0.5 }, { f: 523.25, d: 1.0 },   // E4, G4, C5
        { f: 493.88, d: 0.5 }, { f: 440.00, d: 0.5 }, { f: 392.00, d: 1.0 },   // B4, A4, G4
        { f: 293.66, d: 0.5 }, { f: 349.23, d: 0.5 }, { f: 440.00, d: 1.0 },   // D4, F4, A4
        { f: 392.00, d: 0.5 }, { f: 349.23, d: 0.5 }, { f: 329.63, d: 1.0 }    // G4, F4, E4
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
                masterGain.gain.value = 0.3;
                masterGain.connect(ctx.destination);

                reverbBus = ctx.createGain();
                reverbBus.gain.value = 0.2; // Control reverb amount
                
                const delay = ctx.createDelay();
                delay.delayTime.value = 0.4;
                const feedback = ctx.createGain();
                feedback.gain.value = 0.3;

                reverbBus.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(masterGain);
            }

            // Always try to resume context on user gesture
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            isInitialized = true;
            console.log('Audio Engine Initialized. State:', ctx.state);
        } catch (e) {
            console.error('Web Audio API Initialization Error:', e);
        }
    }

    /**
     * @brief Plays a single "plink" note (music box style)
     */
    function playNote(freq, startTime, duration) {
        if (!isInitialized || isMuted) return;

        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Music Box Envelope: Instant attack, exponential decay
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 1.5);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        noteGain.connect(reverbBus);

        osc.start(startTime);
        osc.stop(startTime + duration * 1.5);
    }

    let isPlaying = false;
    let sequenceTimeout = null;
    let nextNoteTime = 0;

    /**
     * @brief Starts the looping lullaby.
     */
    async function startLullaby() {
        await init();
        if (isPlaying) return;
        
        isPlaying = true;
        nextNoteTime = ctx.currentTime + 0.1;
        const tempo = 1.0; // Seconds per beat

        function scheduleLoop() {
            if (!isPlaying) return;

            // Ensure we aren't scheduling too far in the past
            if (nextNoteTime < ctx.currentTime) {
                nextNoteTime = ctx.currentTime + 0.1;
            }

            let loopDuration = 0;
            LULLABY_NOTES.forEach(note => {
                playNote(note.f, nextNoteTime + loopDuration, note.d * tempo);
                loopDuration += note.d * tempo;
            });

            // Schedule the next block slightly before the current one ends
            const nextBatchWait = (loopDuration - 0.1) * 1000;
            nextNoteTime += loopDuration;
            sequenceTimeout = setTimeout(scheduleLoop, nextBatchWait);
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
            masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.3, ctx.currentTime, 0.1);
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
