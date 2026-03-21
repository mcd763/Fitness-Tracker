const CACHE = 'fittracker-v2';  // was v1
const STATIC = [
  '/Fitness-Tracker/',
  '/Fitness-Tracker/login.html',
  '/Fitness-Tracker/workout.html',
  '/Fitness-Tracker/log.html',
  '/Fitness-Tracker/summary.html',
  '/Fitness-Tracker/fatigue.html',
  '/Fitness-Tracker/progress.html',
  '/Fitness-Tracker/onboarding.html',
  '/Fitness-Tracker/workout.css',
  '/Fitness-Tracker/db.js',
  '/Fitness-Tracker/muscles.json',
  '/Fitness-Tracker/manifest.json',
  '/Fitness-Tracker/icon-192.png',
  '/Fitness-Tracker/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for Supabase calls, cache first for static assets
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request)
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
    )
  );
});