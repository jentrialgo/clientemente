const App = (() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let modelLoaded = false;
  let currentVoice = null;
  let selectedVoice = 'casual_female';
  let lastWavBlob = null;

  // ── Onboarding helpers ──

  function setStep(num) {
    document.querySelectorAll('.step').forEach(s => {
      const n = parseInt(s.dataset.step);
      s.classList.toggle('active', n === num);
      s.classList.toggle('done', n < num);
    });
  }

  function setOnboardingStatus(text) {
    $('status-text').textContent = text;
  }

  function showOnboardingError(msg) {
    const el = $('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function showProgress(stage, percent) {
    // Onboarding progress
    const bar = $('progress-bar');
    const fill = $('progress-fill');
    bar.classList.add('active');
    if (percent != null) fill.style.width = percent + '%';
    setOnboardingStatus(stage);

    // Workspace progress
    const wsBar = $('ws-progress');
    const wsFill = $('ws-progress-fill');
    if (wsBar) {
      wsBar.classList.remove('hidden');
      if (percent != null) wsFill.style.width = percent + '%';
      $('ws-status').textContent = stage;
    }
  }

  function hideProgress() {
    $('progress-bar').classList.remove('active');
    $('progress-fill').style.width = '0%';
    const wsBar = $('ws-progress');
    if (wsBar) wsBar.classList.add('hidden');
  }

  function showWorkspaceError(msg) {
    const el = $('ws-error');
    const dot = $('status-dot');
    if (el) {
      $('ws-error-msg').textContent = msg;
      el.classList.remove('hidden');
    }
    if (dot) {
      dot.classList.remove('ready', 'loading');
      dot.classList.add('error');
    }
    $('ws-status').textContent = 'Error';
  }

  function hideWorkspaceError() {
    const el = $('ws-error');
    const dot = $('status-dot');
    if (el) el.classList.add('hidden');
    if (dot) {
      dot.classList.remove('error');
      dot.classList.add('ready');
    }
    $('ws-status').textContent = 'Ready';
  }

  function updateCharCount() {
    const len = $('text-input').value.length;
    $('char-count').textContent = len + ' chars';
  }

  // ── Transition to workspace ──

  function showWorkspace() {
    $('onboarding').classList.add('hidden');
    $('workspace').classList.remove('hidden');
    $('ws-status').textContent = 'Ready';
    updateCharCount();
    updateCacheInfo();
  }

  async function updateCacheInfo() {
    const cache = await VoxtralTTS.checkCache();
    $('cache-info').textContent = `${cache.shardsCached}/${cache.shardsTotal} shards cached`;
  }

  // ── Core flow ──

  async function initWorker() {
    if (!navigator.gpu) {
      setOnboardingStatus('');
      showOnboardingError('WebGPU is not supported in this browser. Try Chrome 113+ or Edge 113+.');
      return;
    }

    setStep(1);
    setOnboardingStatus('Initializing WebGPU...');
    try {
      await VoxtralTTS.init();
      setStep(1);

      // Check if model is already cached → auto-load
      const cache = await VoxtralTTS.checkCache();
      if (cache.cached) {
        setOnboardingStatus('Model cached — loading...');
        $('load-btn').disabled = true;
        $('load-btn').querySelector('.onboarding__btn-sub').textContent = 'Loading from cache...';
        await autoLoad();
      } else {
        setOnboardingStatus('Ready to download');
        $('load-btn').disabled = false;
        if (cache.shardsCached > 0) {
          $('load-btn').querySelector('.onboarding__btn-sub').textContent =
            `${cache.shardsCached}/${cache.shardsTotal} shards cached · resumes where it left off`;
        }
      }
    } catch (e) {
      showOnboardingError('Failed to initialize: ' + e.message);
    }
  }

  async function autoLoad() {
    setStep(2);
    try {
      await VoxtralTTS.loadModel();
      hideProgress();
      setStep(3);
      modelLoaded = true;
      setTimeout(showWorkspace, 600);
    } catch (e) {
      showOnboardingError('Load failed: ' + e.message);
      $('load-btn').disabled = false;
    }
  }

  async function loadModel() {
    $('load-btn').disabled = true;
    setStep(2);
    try {
      await VoxtralTTS.loadModel();
      hideProgress();
      setStep(3);
      setOnboardingStatus('Model loaded!');
      modelLoaded = true;
      setTimeout(showWorkspace, 600);
    } catch (e) {
      hideProgress();
      showOnboardingError('Download failed: ' + e.message);
      $('load-btn').disabled = false;
    }
  }

  async function speak() {
    const text = $('text-input').value.trim();
    if (!text) return;

    setSpeakBusy(true);

    try {
      // Load voice if changed
      if (selectedVoice !== currentVoice) {
        showProgress(`Loading voice...`, null);
        await VoxtralTTS.loadVoice(selectedVoice);
        currentVoice = selectedVoice;
      }

      showProgress('Tokenizing...', null);
      const tokenIds = await VoxtralTTS.tokenize(text);

      const maxFrames = Math.min(2000, Math.max(50, tokenIds.length * 30));
      showProgress('Synthesizing speech...', null);
      const t0 = performance.now();
      const { samples, sampleRate } = await VoxtralTTS.synthesize(tokenIds, maxFrames);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      const duration = (samples.length / sampleRate).toFixed(2);
      const rtf = (parseFloat(elapsed) / parseFloat(duration)).toFixed(1);

      hideProgress();
      $('ws-status').textContent = 'Done';

      // Show result
      lastWavBlob = VoxtralTTS.samplesToWavBlob(samples, sampleRate);
      const url = URL.createObjectURL(lastWavBlob);
      $('audio-player').src = url;
      $('output-placeholder').classList.add('hidden');
      $('output-result').classList.remove('hidden');
      $('download-btn').classList.remove('hidden');
      $('audio-duration').textContent = `${duration}s @ ${sampleRate / 1000} kHz`;
      $('audio-timing').textContent = `${elapsed}s · RTF ${rtf}x`;
    } catch (e) {
      hideProgress();
      showWorkspaceError(e.message || 'Synthesis failed');
    } finally {
      setSpeakBusy(false);
    }
  }

  function setSpeakBusy(busy) {
    const btn = $('speak-btn');
    btn.disabled = busy;
    btn.querySelector('.btn-speak__idle').classList.toggle('hidden', busy);
    btn.querySelector('.btn-speak__busy').classList.toggle('hidden', !busy);
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

  // ── Voice picker ──

  function selectVoice(voiceName) {
    selectedVoice = voiceName;
    document.querySelectorAll('.voice-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.voice === voiceName);
    });
  }

  // ── Sample chips ──

  function applySample(text, voice) {
    $('text-input').value = text;
    updateCharCount();
    if (voice) selectVoice(voice);
  }

  // ── Init ──

  function init() {
    SharedCore.initTheme(document.getElementById('theme-toggle'));

    VoxtralTTS.setOnProgress((stage, percent) => showProgress(stage, percent));
    VoxtralTTS.setOnError((msg) => {
      hideProgress();
      if (modelLoaded) {
        showWorkspaceError(msg);
        setSpeakBusy(false);
      } else {
        showOnboardingError(msg);
      }
    });

    // Onboarding
    $('load-btn').addEventListener('click', loadModel);

    // Workspace events
    $('speak-btn').addEventListener('click', speak);
    $('clear-btn').addEventListener('click', clearText);
    $('download-btn').addEventListener('click', downloadWav);
    $('clear-cache-btn').addEventListener('click', clearCacheAction);
    $('text-input').addEventListener('input', updateCharCount);
    $('ws-error-close').addEventListener('click', hideWorkspaceError);

    // Voice pills
    document.querySelectorAll('.voice-pill').forEach(pill => {
      pill.addEventListener('click', () => selectVoice(pill.dataset.voice));
    });

    // Sample chips
    document.querySelectorAll('.sample-chip').forEach(chip => {
      chip.addEventListener('click', () => applySample(chip.dataset.text, chip.dataset.voice));
    });

    initWorker();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { ...SharedCore };
})();
