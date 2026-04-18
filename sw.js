const CACHE = 'kjd-v1';
const IMMUTABLE = ['/assets/styles.css', '/assets/app.js'];
const SHELL = ['/', '/index.html', '/data/index.json'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll([...SHELL, ...IMMUTABLE]))
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
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

    // Day JSON files are immutable once written — cache-first
    if (url.pathname.match(/\/data\/day-\d+\.json$/)) {
        e.respondWith(
            caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
                return res;
            }))
        );
        return;
    }

    // index.json and shell — network-first so updates propagate
    e.respondWith(
        fetch(e.request).then(res => {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
            return res;
        }).catch(() => caches.match(e.request))
    );
});
