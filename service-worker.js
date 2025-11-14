// Define um nome e versão para o cache.
// Mudar a versão fará com que o Service Worker atualize o cache.
const CACHE_NAME = 'route-genesis-cache-v1';

// Lista de arquivos essenciais para o "App Shell" que serão cacheados na instalação.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  // IMPORTANTE: Adicione o caminho para a biblioteca Pixi.js se você a estiver hospedando localmente.
  // Exemplo: '/libs/pixi.min.js', 
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Evento 'install': acionado quando o Service Worker é registrado pela primeira vez.
self.addEventListener('install', (event) => {
  // O waitUntil garante que o Service Worker não será instalado até que o código dentro dele seja executado.
  event.waitUntil(
    // Abre o cache com o nome que definimos.
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        // Adiciona todos os arquivos do App Shell ao cache.
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Evento 'activate': acionado após a instalação e quando o Service Worker assume o controle.
// É o lugar perfeito para limpar caches antigos.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Se um nome de cache não corresponde ao cache atual, ele é excluído.
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: limpando cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Garante que o novo Service Worker assuma o controle da página imediatamente.
  return self.clients.claim();
});


// Evento 'fetch': acionado toda vez que o app faz uma requisição de rede (ex: para um arquivo, imagem, etc.).
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // respondWith intercepta a requisição e nos permite fornecer nossa própria resposta.
  event.respondWith(
    // Tenta encontrar uma resposta para a requisição no cache.
    caches.match(event.request)
      .then((response) => {
        // Se a resposta for encontrada no cache, a retorna.
        if (response) {
          return response;
        }
        
        // Se não for encontrada no cache, busca na rede.
        console.log('Service Worker: buscando recurso na rede: ', event.request.url);
        return fetch(event.request);
      })
  );
});
