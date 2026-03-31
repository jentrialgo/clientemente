const App = (() => {
  'use strict';

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);

  let modelLoaded = false;
  let currentVoice = null;
  let lastWavBlob = null;

  // ── Status helpers ──
  function setStatus(state, text) {
    $('status-dot').className = 'status-dot ' + state;
    $('status-text').textContent = text;
  }

  function showProgress(stage, percent) {
    $('progress-bar').classList.add('active');
    if (percent != null) $('progress-fill').style.width = percent + '%';
    setStatus('loading', stage);
  }

  function hideProgress() {
    $('progress-bar').classList.remove('active');
    $('progress-fill').style.width = '0%';
  }

  function updateCharCount() {
    const len = $('text-input').value.length;
    $('char-count').textContent = len + ' characters';
  }

  // ── Core flow ──

  async function initWorker() {
    if (!navigator.gpu) {
      setStatus('error', 'WebGPU is not supported in this browser. Try Chrome 113+ or Edge 113+.');
      return;
    }

    setStatus('loading', 'Initializing WebGPU...');
    try {
      await VoxtralTTS.init();
      setStatus('ready', 'Ready — load model to begin');
      $('load-btn').disabled = false;

      const cache = await VoxtralTTS.checkCache();
      if (cache.cached) {
        $('cache-info').textContent = `${cache.shardsCached}/${cache.shardsTotal} shards cached`;
      } else if (cache.shardsCached > 0) {
        $('cache-info').textContent = `${cache.shardsCached}/${cache.shardsTotal} shards cached`;
      }
    } catch (e) {
      setStatus('error', 'Failed to initialize: ' + e.message);
    }
  }

  async function loadModel() {
    $('load-btn').disabled = true;
    try {
      await VoxtralTTS.loadModel();
      hideProgress();
      setStatus('ready', 'Model loaded — paste text and speak');
      modelLoaded = true;
      $('text-input').disabled = false;
      $('voice-select').disabled = false;
      $('speak-btn').disabled = false;

      const cache = await VoxtralTTS.checkCache();
      $('cache-info').textContent = `${cache.shardsCached}/${cache.shardsTotal} shards cached`;
    } catch (e) {
      hideProgress();
      setStatus('error', 'Load failed: ' + e.message);
      $('load-btn').disabled = false;
    }
  }

  async function speak() {
    const text = $('text-input').value.trim();
    if (!text) return;

    $('speak-btn').disabled = true;
    const voice = $('voice-select').value;

    try {
      // Load voice if changed
      if (voice !== currentVoice) {
        showProgress(`Loading voice "${voice}"...`, null);
        await VoxtralTTS.loadVoice(voice);
        currentVoice = voice;
      }

      // Tokenize via WASM Tekken BPE
      showProgress('Tokenizing...', null);
      const tokenIds = await VoxtralTTS.tokenize(text);

      // Synthesize
      const maxFrames = Math.min(2000, Math.max(50, tokenIds.length * 30));
      showProgress('Synthesizing speech...', null);
      const t0 = performance.now();
      const { samples, sampleRate } = await VoxtralTTS.synthesize(tokenIds, maxFrames);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      const duration = (samples.length / sampleRate).toFixed(2);
      const rtf = (parseFloat(elapsed) / parseFloat(duration)).toFixed(1);

      hideProgress();
      setStatus('ready', 'Done — play or download the audio');

      // Create WAV and play
      lastWavBlob = VoxtralTTS.samplesToWavBlob(samples, sampleRate);
      const url = URL.createObjectURL(lastWavBlob);
      $('audio-player').src = url;
      $('output-card').classList.remove('hidden');
      $('audio-duration').textContent = `${duration}s @ ${sampleRate / 1000} kHz`;
      $('audio-samples').textContent = `${samples.length.toLocaleString()} samples`;
      $('audio-timing').textContent = `Generated in ${elapsed}s · RTF ${rtf}x`;
    } catch (e) {
      hideProgress();
      setStatus('error', 'Synthesis failed: ' + e.message);
    } finally {
      $('speak-btn').disabled = !modelLoaded;
    }
  }

  function downloadWav() {
    if (!lastWavBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastWavBlob);
    a.download = `voxtral-tts-${Date.now()}.wav`;
    a.click();
  }

  function clearText() {
    $('text-input').value = '';
    updateCharCount();
  }

  async function clearCacheAction() {
    await VoxtralTTS.clearCache();
    $('cache-info').textContent = 'Cache cleared';
  }

  // ── Init ──

  function init() {
    SharedCore.initTheme(document.getElementById('theme-toggle'));

    // Wire callbacks
    VoxtralTTS.setOnProgress((stage, percent) => showProgress(stage, percent));
    VoxtralTTS.setOnError((msg) => { hideProgress(); setStatus('error', msg); });

    // Wire UI events
    $('load-btn').addEventListener('click', loadModel);
    $('speak-btn').addEventListener('click', speak);
    $('clear-btn').addEventListener('click', clearText);
    $('download-btn').addEventListener('click', downloadWav);
    $('clear-cache-btn').addEventListener('click', clearCacheAction);
    $('text-input').addEventListener('input', updateCharCount);

    updateCharCount();
    initWorker();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { ...SharedCore };
})();
