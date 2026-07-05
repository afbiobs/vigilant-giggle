// Kill-switch service worker.
//
// The previous worker cached day-NNN.json responses cache-first WITHOUT
// checking they succeeded, so a 404 (reading not uploaded yet) was cached
// permanently and returning visitors kept seeing the day-1 fallback until
// they manually cleared browser data.
//
// Caching adds little for this site (one small JSON per day), so instead of
// patching the cache logic this worker deletes all caches and uninstalls
// itself. It must remain deployed at /sw.js so browsers that installed the
// old worker pick it up and self-heal on their next visit.
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        await self.registration.unregister();

        // Reload any open pages once so the fix applies on this visit —
        // but only if stale caches were actually deleted. That guard
        // prevents a reload loop if an old HTTP-cached app.js re-registers
        // this worker. Strip the ?day param, which the old app wrote even
        // for the day-1 fallback.
        if (keys.length > 0) {
            const clients = await self.clients.matchAll({ type: 'window' });
            for (const client of clients) {
                const url = new URL(client.url);
                url.searchParams.delete('day');
                client.navigate(url.href);
            }
        }
    })());
});
