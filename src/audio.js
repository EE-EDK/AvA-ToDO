/**
 * @file audio.js
 * @brief Procedural audio engine for Ava Arrival Prep.
 *        Implements a slow, warm bell style Brahms' Lullaby with user-defined notes.
 * @version 1.4
 */

const AudioEngine = (function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let reverbBus = null;
    let isInitialized = false;
    let isMuted = false;

    // Brahms' Lullaby Melody (User Defined Notes in 6th Octave)
    const LULLABY_NOTES = [
        // "Lullaby and goodnight"
        { f: 783.99, d: 0.8 }, { f: 783.99, d: 0.8 }, { f: 1046.50, d: 0.8 }, { f: 1046.50, d: 0.8 }, { f: 1046.50, d: 1.6 },
        { f: 1318.51, d: 0.8 }, { f: 1318.51, d: 0.8 }, { f: 1567.98, d: 0.8 }, { f: 1567.98, d: 0.8 }, { f: 1567.98, d: 1.6 },
        
        // "With roses bedight"
        { f: 1174.66, d: 0.8 }, { f: 1174.66, d: 0.8 }, { f: 1567.98, d: 0.8 }, { f: 1567.98, d: 0.8 }, { f: 1567.98, d: 1.6 },
        { f: 1318.51, d: 0.8 }, { f: 1318.51, d: 0.8 }, { f: 1046.50, d: 0.8 }, { f: 1046.50, d: 0.8 }, { f: 1046.50, d: 1.6 },
        
        // "Go to sleep, little baby..." (Descending pattern)
        { f: 1046.50, d: 0.8 }, { f: 1046.50, d: 0.8 }, { f: 1567.98, d: 1.6 },
        { f: 1396.91, d: 0.8 }, { f: 1318.51, d: 0.8 }, { f: 1174.66, d: 0.8 }, { f: 1046.50, d: 2.0 }
    ];

    /**
     * @brief Initializes the Web Audio context and graph.
     */
    async function init() {
        // If already running, nothing to do
        if (ctx && ctx.state === 'running') return true;

        try {
            if (!ctx) {
                console.log('Creating new AudioContext...');
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                
                masterGain = ctx.createGain();
                masterGain.gain.value = 0.2; 
                masterGain.connect(ctx.destination);

                reverbBus = ctx.createGain();
                reverbBus.gain.value = 0.5;
                
                const delay = ctx.createDelay();
                delay.delayTime.value = 0.8;
                const feedback = ctx.createGain();
                feedback.gain.value = 0.15;

                reverbBus.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                delay.connect(masterGain);
            }

            // Attempt to resume if suspended (standard browser behavior)
            if (ctx.state === 'suspended') {
                console.log('Resuming suspended AudioContext...');
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

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.25, startTime + 0.1); 
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
        const success = await init();
        if (!success || isPlaying) return;
        
        console.log('Starting Lullaby sequence...');
        isPlaying = true;
        nextNoteTime = ctx.currentTime + 0.2;
        const tempo = 1.8;

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
            nextNoteTime += loopDuration + 3.0;
            sequenceTimeout = setTimeout(scheduleLoop, nextBatchWait + 3000);
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
            masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.2, ctx.currentTime, 0.2);
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
