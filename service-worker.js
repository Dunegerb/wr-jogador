const CACHE_NAME = 'route-genesis-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Adicione aqui outros assets estáticos que você criar (CSS, JS, imagens)
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache se encontrado
        }
        return fetch(event.request); // Busca na rede se não estiver no cache
      }
    )
  );
});
