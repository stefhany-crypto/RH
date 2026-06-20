const CACHE = 'mirae-pdi-v69';
const ASSETS = [
    '/', '/index.html', '/manifest.json',
    '/js/globals.js', '/js/utils.js', '/js/permissoes.js', '/js/app.js',
    '/js/colaboradores.js', '/js/avaliacoes.js', '/js/relatorios.js',
    '/js/daily.js', '/js/tarefas.js', '/js/vtvr.js', '/js/kanban.js',
    '/js/backup.js', '/js/reservas.js', '/js/bonus.js',
    '/js/remuneracao.js',
    '/js/vendor/chart.min.js', '/js/vendor/jspdf.umd.min.js',
    '/js/vendor/xlsx.full.min.js', '/js/vendor/jszip.min.js'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if(!e.request.url.startsWith('http')) return;
    if(e.request.url.includes('firestore') || e.request.url.includes('firebase') || e.request.url.includes('googleapis')) return;

    const url = new URL(e.request.url);
    const isNav    = e.request.mode === 'navigate';
    // JS da aplicaÃ§Ã£o (nÃ£o vendor): precisa estar SEMPRE fresco quando online,
    // senÃ£o correÃ§Ãµes nÃ£o chegam ao usuÃ¡rio (ficava preso em cÃ³digo antigo).
    const isAppJs  = url.pathname.startsWith('/js/') && url.pathname.endsWith('.js') && !url.pathname.startsWith('/js/vendor/');
    // Bibliotecas de terceiros, CSS, imagens e fontes: grandes e estÃ¡veis â†’ cache-first.
    const isStatic = !isAppJs && (/\.(css|png|svg|webp|ico|woff2?|ttf)$/.test(url.pathname) || url.pathname.startsWith('/js/vendor/') || url.pathname.endsWith('.js'));

    if(isNav || isAppJs){
        // HTML e JS da aplicaÃ§Ã£o: network-first (sempre fresco online; cache sÃ³
        // como fallback offline). Elimina o problema de "cÃ³digo antigo em cache".
        e.respondWith(
            fetch(new Request(e.request.url, { cache: 'no-store' }))
                .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
                .catch(() => caches.match(e.request))
        );
    } else if(isStatic){
        // vendor/CSS/imagens/fontes: cache-first â€” bateu no cache, nÃ£o vai Ã  rede
        e.respondWith(
            caches.match(e.request).then(cached => {
                if(cached) return cached;
                return fetch(e.request).then(res => {
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    return res;
                });
            })
        );
    } else {
        // Demais requisiÃ§Ãµes: network-first com fallback
        e.respondWith(
            fetch(e.request)
                .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
                .catch(() => caches.match(e.request))
        );
    }
});
