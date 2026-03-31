/**
 * Voxtral TTS WebWorker — loads WASM + WebGPU and performs Q4 GGUF
 * text-to-speech off the main thread.
 *
 * The WASM pkg is fetched from the HuggingFace Space (which has the
 * latest working build) and the JS glue is loaded via a same-origin
 * blob URL to avoid CORS restrictions on ES module imports.
 *
 * Messages in:
 *   { type: 'init' }
 *   { type: 'loadModel' }
 *   { type: 'loadVoice', voiceName }
 *   { type: 'tokenize', text }
 *   { type: 'synthesize', tokenIds, maxFrames }
 *   { type: 'checkCache' }
 *   { type: 'clearCache' }
 */

const PKG_BASE = 'https://huggingface.co/spaces/TrevorJS/voxtral-4b-tts/resolve/main/pkg';
const HF_MODEL = 'https://huggingface.co/TrevorJS/voxtral-tts-q4-gguf/resolve/main';
const HF_VOICES = 'https://huggingface.co/TrevorJS/voxtral-tts-q4-gguf/resolve/main/voice_embedding';
const HF_TOKENIZER = 'https://huggingface.co/TrevorJS/voxtral-tts-q4-gguf/resolve/main/tekken.json';
const SHARD_NAMES = ['shard-aa', 'shard-ab', 'shard-ac', 'shard-ad', 'shard-ae', 'shard-af'];
const CACHE_NAME = 'voxtral-tts-weights-v1';

let wasm = null;
let tts = null;
let tokenizer = null;

// Catch WASM panics and other unhandled errors/rejections so
// they propagate back to the main thread instead of silently dying.
self.addEventListener('error', (e) => {
  self.postMessage({ type: 'error', message: e.message || 'Unexpected worker error' });
});
self.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason) || 'Unhandled worker error';
  self.postMessage({ type: 'error', message: msg });
});

self.onmessage = async (e) => {
  const { type, ...data } = e.data;
  try {
    switch (type) {
      case 'init':       await handleInit(); break;
      case 'loadModel':  await handleLoadModel(); break;
      case 'loadVoice':  await handleLoadVoice(data.voiceName); break;
      case 'tokenize':   handleTokenize(data.text); break;
      case 'synthesize': await handleSynthesize(data.tokenIds, data.maxFrames ?? 200); break;
      case 'checkCache': await handleCheckCache(); break;
      case 'clearCache': await handleClearCache(); break;
      default: throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || String(error) });
  }
};

async function handleInit() {
  self.postMessage({ type: 'progress', stage: 'Loading WASM module...', percent: 5 });

  // Fetch JS glue as text and create a same-origin blob URL
  // to avoid CORS restrictions on cross-origin ES module imports.
  const jsResp = await fetch(`${PKG_BASE}/voxtral_mini_realtime.js`);
  if (!jsResp.ok) throw new Error(`Failed to load WASM JS: ${jsResp.status}`);
  const jsText = await jsResp.text();
  const jsBlob = new Blob([jsText], { type: 'application/javascript' });
  const jsBlobUrl = URL.createObjectURL(jsBlob);
  wasm = await import(jsBlobUrl);
  URL.revokeObjectURL(jsBlobUrl);

  self.postMessage({ type: 'progress', stage: 'Initializing WASM...', percent: 10 });
  await wasm.default(`${PKG_BASE}/voxtral_mini_realtime_bg.wasm`);

  self.postMessage({ type: 'progress', stage: 'Initializing WebGPU device...', percent: 15 });
  await wasm.initWgpuDevice();

  tts = new wasm.VoxtralTts();
  self.postMessage({ type: 'ready' });
}

async function cachedFetch(cache, url) {
  const cached = await cache.match(url);
  if (cached) return { response: cached, fromCache: true };
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText} — ${url}`);
  await cache.put(url, resp.clone());
  return { response: resp, fromCache: false };
}

async function handleLoadModel() {
  if (!tts) throw new Error('Worker not initialized.');
  const cache = await caches.open(CACHE_NAME);

  for (let i = 0; i < SHARD_NAMES.length; i++) {
    const name = SHARD_NAMES[i];
    const url = `${HF_MODEL}/${name}`;
    self.postMessage({
      type: 'progress',
      stage: `Loading ${name} (${i + 1}/${SHARD_NAMES.length})...`,
      percent: Math.round((i / SHARD_NAMES.length) * 60),
    });

    const { response } = await cachedFetch(cache, url);
    const buf = await response.arrayBuffer();
    tts.appendModelShard(new Uint8Array(buf));
  }

  // Load tokenizer
  self.postMessage({ type: 'progress', stage: 'Loading tokenizer...', percent: 65 });
  const { response: tokResp } = await cachedFetch(cache, HF_TOKENIZER);
  const tokenizerJson = await tokResp.text();
  tokenizer = new wasm.TekkenTokenizerWasm(tokenizerJson);

  // Finalize model
  self.postMessage({ type: 'progress', stage: 'Loading into WebGPU...', percent: 70 });
  tts.loadModelFromShards();

  self.postMessage({ type: 'modelLoaded' });
}

function handleTokenize(text) {
  if (!tokenizer) throw new Error('Tokenizer not loaded.');
  const ids = tokenizer.encode(text);
  self.postMessage({ type: 'tokenized', tokenIds: Array.from(ids) });
}

const voiceCache = new Map();

async function handleLoadVoice(voiceName) {
  if (!tts) throw new Error('Worker not initialized.');
  if (voiceCache.has(voiceName)) {
    self.postMessage({ type: 'voiceLoaded', voiceName });
    return;
  }

  self.postMessage({ type: 'progress', stage: `Loading voice "${voiceName}"...` });
  const cache = await caches.open(CACHE_NAME);
  const url = `${HF_VOICES}/${voiceName}.safetensors`;
  const { response } = await cachedFetch(cache, url);
  const buf = await response.arrayBuffer();
  tts.loadVoice(new Uint8Array(buf));
  voiceCache.set(voiceName, true);
  self.postMessage({ type: 'voiceLoaded', voiceName });
}

async function handleSynthesize(tokenIds, maxFrames) {
  if (!tts || !tts.isReady()) throw new Error('Model or voice not loaded.');
  self.postMessage({ type: 'progress', stage: 'Synthesizing speech...' });

  const ids = tokenIds instanceof Uint32Array ? tokenIds : new Uint32Array(tokenIds);
  const samples = await tts.synthesize(ids, maxFrames);
  self.postMessage({ type: 'audio', samples, sampleRate: 24000 }, [samples.buffer]);
}

async function handleCheckCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const shardsCached = SHARD_NAMES.filter(name => keys.some(k => k.url.endsWith(name)));
    self.postMessage({
      type: 'cacheStatus',
      cached: shardsCached.length === SHARD_NAMES.length,
      shardsCached: shardsCached.length,
      shardsTotal: SHARD_NAMES.length,
    });
  } catch {
    self.postMessage({ type: 'cacheStatus', cached: false, shardsCached: 0, shardsTotal: SHARD_NAMES.length });
  }
}

async function handleClearCache() {
  const deleted = await caches.delete(CACHE_NAME);
  voiceCache.clear();
  self.postMessage({ type: 'cacheCleared', deleted });
}
