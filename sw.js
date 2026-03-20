// Flight Sim Tile Cache Service Worker
// Cache-first strategy for Cesium terrain + imagery tiles
// 250MB max with LRU eviction

const CACHE_NAME = 'flightsim-tiles-v1';
const MAX_CACHE_BYTES = 250 * 1024 * 1024; // 250MB

// Patterns to cache (Cesium Ion terrain, Bing imagery, OSM buildings)
const CACHEABLE_PATTERNS = [
  /\.quantized-mesh/,
  /assets\.ion\.cesium\.com/,
  /api\.cesium\.com/,
  /ecn\.t\d+\.tiles\.virtualearth\.net/,    // Bing Maps tiles
  /dev\.virtualearth\.net/,                   // Bing Maps metadata
  /t\d+\.ssl\.ak\.tiles\.virtualearth\.net/, // Bing SSL tiles
  /3d-tiles/,                                 // OSM buildings
  /\.terrain$/,
  /\.b3dm$/,
  /\.cmpt$/,
  /\.glb$/,
  /\.pnts$/,
  /tile/i,
];

function shouldCache(url) {
  return CACHEABLE_PATTERNS.some(p => p.test(url));
}

// Track entry metadata in a separate cache for LRU
const META_CACHE = 'flightsim-meta-v1';

async function getMetadata() {
  try {
    const cache = await caches.open(META_CACHE);
    const resp = await cache.match('metadata');
    if (resp) return await resp.json();
  } catch (e) {}
  return { entries: {}, totalBytes: 0 };
}

async function setMetadata(meta) {
  const cache = await caches.open(META_CACHE);
  await cache.put('metadata', new Response(JSON.stringify(meta)));
}

async function evictIfNeeded(meta) {
  if (meta.totalBytes <= MAX_CACHE_BYTES) return meta;

  const cache = await caches.open(CACHE_NAME);
  // Sort by last accessed time (oldest first)
  const sorted = Object.entries(meta.entries).sort((a, b) => a[1].lastAccess - b[1].lastAccess);

  for (const [url, info] of sorted) {
    if (meta.totalBytes <= MAX_CACHE_BYTES * 0.8) break; // Evict down to 80%
    await cache.delete(url);
    meta.totalBytes -= info.size;
    delete meta.entries[url];
  }

  return meta;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (!shouldCache(url)) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Check cache first
      const cached = await cache.match(event.request);
      if (cached) {
        // Update last access time in background (don't block response)
        updateAccessTime(url).catch(() => {});
        return cached;
      }

      // Cache miss — fetch from network
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const clone = response.clone();
          // Store in cache in background
          storeInCache(cache, event.request, clone, url).catch(() => {});
        }
        return response;
      } catch (err) {
        // Network failed, no cache — just propagate error
        throw err;
      }
    })()
  );
});

async function updateAccessTime(url) {
  const meta = await getMetadata();
  if (meta.entries[url]) {
    meta.entries[url].lastAccess = Date.now();
    await setMetadata(meta);
  }
}

async function storeInCache(cache, request, response, url) {
  const buf = await response.clone().arrayBuffer();
  const size = buf.byteLength;

  await cache.put(request, response);

  let meta = await getMetadata();
  meta.entries[url] = { size, lastAccess: Date.now(), stored: Date.now() };
  meta.totalBytes += size;

  meta = await evictIfNeeded(meta);
  await setMetadata(meta);
}

// Expose cache stats via message
self.addEventListener('message', async (event) => {
  if (event.data === 'cache-stats') {
    const meta = await getMetadata();
    const count = Object.keys(meta.entries).length;
    event.source.postMessage({
      type: 'cache-stats',
      totalMB: (meta.totalBytes / (1024 * 1024)).toFixed(1),
      count,
      maxMB: (MAX_CACHE_BYTES / (1024 * 1024)).toFixed(0),
    });
  }
  if (event.data === 'clear-cache') {
    await caches.delete(CACHE_NAME);
    await caches.delete(META_CACHE);
    event.source.postMessage({ type: 'cache-cleared' });
  }
});
