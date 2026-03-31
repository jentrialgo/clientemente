/**
 * VoxtralTTS — main-thread client wrapping the WebWorker and audio playback.
 * Follows the project IIFE pattern.
 */
const VoxtralTTS = (() => {
  'use strict';

  let worker = null;
  let pending = null;
  let onProgress = null;
  let onError = null;

  // ── Worker communication helpers ──

  function postAndWait(msg) {
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      worker.postMessage(msg);
    });
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'ready':
      case 'modelLoaded':
      case 'voiceLoaded':
        if (pending) { pending.resolve(data); pending = null; }
        break;

      case 'audio':
        if (pending) {
          pending.resolve({
            samples: new Float32Array(data.samples),
            sampleRate: data.sampleRate,
          });
          pending = null;
        }
        break;

      case 'tokenized':
        if (pending) {
          pending.resolve(new Uint32Array(data.tokenIds));
          pending = null;
        }
        break;

      case 'cacheStatus':
      case 'cacheCleared':
        if (pending) { pending.resolve(data); pending = null; }
        break;

      case 'progress':
        if (onProgress) onProgress(data.stage, data.percent);
        break;

      case 'error':
        if (pending) {
          pending.reject(new Error(data.message));
          pending = null;
        } else if (onError) {
          onError(data.message);
        }
        break;
    }
  }

  // ── Public API ──

  async function init() {
    return new Promise((resolve, reject) => {
      worker = new Worker('./js/worker.js', { type: 'module' });
      worker.onmessage = (e) => handleMessage(e.data);
      worker.onerror = (e) => {
        if (onError) onError(e.message);
        reject(e);
      };
      pending = { resolve, reject };
      worker.postMessage({ type: 'init' });
    });
  }

  function loadModel()            { return postAndWait({ type: 'loadModel' }); }
  function loadVoice(voiceName)   { return postAndWait({ type: 'loadVoice', voiceName }); }
  function tokenize(text)         { return postAndWait({ type: 'tokenize', text }); }
  function checkCache()           { return postAndWait({ type: 'checkCache' }); }
  function clearCache()           { return postAndWait({ type: 'clearCache' }); }

  function synthesize(tokenIds, maxFrames = 200) {
    return postAndWait({
      type: 'synthesize',
      tokenIds: Array.from(tokenIds),
      maxFrames,
    });
  }

  // ── WAV encoding ──

  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  function samplesToWavBlob(samples, sampleRate) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // ── Setters for callbacks ──

  function setOnProgress(fn) { onProgress = fn; }
  function setOnError(fn)    { onError = fn; }

  return {
    init,
    loadModel,
    loadVoice,
    tokenize,
    synthesize,
    checkCache,
    clearCache,
    samplesToWavBlob,
    setOnProgress,
    setOnError,
  };
})();
