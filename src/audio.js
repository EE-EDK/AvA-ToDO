/**
 * @file audio.js
 * @brief Audio player for Brahms' Lullaby WAV file.
 *        Plays on a continuous loop with a brief pause between repeats.
 * @version 3.0
 */

const AudioEngine = (function () {
    'use strict';

    let audio = null;
    let isMuted = false;
    let isPlaying = false;
    let loopTimer = null;
    const PAUSE_BETWEEN_LOOPS = 3000; // 3-second pause between loops

    function createAudio() {
        if (audio) return;
        audio = new Audio('src/brahms-melody.wav');
        audio.volume = 0.3;
        audio.addEventListener('ended', () => {
            // When the track ends, wait then replay
            loopTimer = setTimeout(() => {
                if (isPlaying && !isMuted) {
                    audio.currentTime = 0;
                    audio.play().catch(() => {});
                }
            }, PAUSE_BETWEEN_LOOPS);
        });
    }

    async function init() {
        createAudio();
        return true;
    }

    async function startLullaby() {
        createAudio();
        if (isPlaying) return;
        isPlaying = true;
        if (!isMuted) {
            try {
                audio.currentTime = 0;
                await audio.play();
            } catch (e) {
                console.warn('Audio playback blocked:', e.message);
            }
        }
    }

    function stopLullaby() {
        isPlaying = false;
        if (loopTimer) clearTimeout(loopTimer);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }

    function toggleMute() {
        isMuted = !isMuted;
        if (audio) {
            if (isMuted) {
                audio.pause();
                if (loopTimer) clearTimeout(loopTimer);
            } else if (isPlaying) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            }
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
