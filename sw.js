"use strict";

// Cambia este número cada vez que subas archivos nuevos.
const CACHE = "calendario-v3";

const ARCHIVOS = [
  "./",
  "index.html",
  "styles.css",
  "db.js",
  "mi-semana.js",
  "app.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres.filter((nombre) => nombre !== CACHE).map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para recibir cambios al momento); si no hay conexión, la copia guardada.
self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET" || new URL(peticion.url).origin !== self.location.origin) {
    return;
  }

  evento.respondWith(
    fetch(peticion, { cache: "no-cache" })
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() =>
        caches.match(peticion, { ignoreSearch: true }).then((guardada) =>
          guardada || (peticion.mode === "navigate" ? caches.match("index.html") : Response.error())
        )
      )
  );
});
