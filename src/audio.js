/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements a music box style Brahms' Lullaby.
 * @version 1.0
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let reverbBus = null;
    let isInitialized = false;
    let isMuted = false;

    // Brahms' Lullaby Melody (Notes and Durations)
    // Simplified for a cute music box effect
    // 4 = quarter, 8 = eighth, 2 = half, etc.
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
     * Must be called from a user gesture.
     */
    function init() {
        if (isInitialized) return;

        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = 0.3; // Gentle volume
            masterGain.connect(ctx.destination);

            // Simple Reverb (Music box needs space)
            reverbBus = ctx.createGain();
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.15;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.4;

            reverbBus.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(masterGain);

            isInitialized = true;
            console.log('Audio Engine Initialized');
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    }

    /**
     * @brief Plays a single "plink" note (music box style)
     */
    function playNote(freq, startTime, duration) {
        if (!isInitialized || isMuted) return;

        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        // Music box timbre: Sine + soft Square harmonic
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Fast attack, slow decay (plink)
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 2);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        noteGain.connect(reverbBus);

        osc.start(startTime);
        osc.stop(startTime + duration * 2);
    }

    let isPlaying = false;
    let sequenceTimeout = null;

    /**
     * @brief Starts the looping lullaby.
     */
    function startLullaby() {
        if (!isInitialized) init();
        if (isPlaying) return;
        
        isPlaying = true;
        let currentTime = ctx.currentTime + 0.1;
        const tempo = 1.2; // Seconds per beat

        function scheduleLoop() {
            let loopDuration = 0;
            LULLABY_NOTES.forEach(note => {
                playNote(note.f, currentTime + loopDuration, note.d * tempo);
                loopDuration += note.d * tempo;
            });

            // Schedule next loop iteration
            sequenceTimeout = setTimeout(scheduleLoop, loopDuration * 1000);
            currentTime += loopDuration;
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

// Export to window for easy access
window.AudioEngine = AudioEngine;
