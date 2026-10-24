"use strict";

const VERSION = "0.1.0";
const PANTALLAS = ["hoy", "semana", "mes", "mi-semana", "ajustes"];

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

let pantallaAnterior = "hoy";

function pantallaActual() {
  const nombre = location.hash.replace("#", "");
  return PANTALLAS.includes(nombre) ? nombre : "hoy";
}

function mostrarPantalla() {
  const actual = pantallaActual();

  document.querySelectorAll(".pantalla").forEach((seccion) => {
    seccion.hidden = seccion.id !== "pantalla-" + actual;
  });

  document.querySelectorAll(".pestana").forEach((pestana) => {
    if (pestana.dataset.pantalla === actual) {
      pestana.setAttribute("aria-current", "page");
    } else {
      pestana.removeAttribute("aria-current");
    }
  });

  const seccion = document.getElementById("pantalla-" + actual);
  document.getElementById("titulo").textContent = seccion.dataset.titulo;
  document.getElementById("boton-ajustes").setAttribute("aria-pressed", String(actual === "ajustes"));

  if (actual !== "ajustes") {
    pantallaAnterior = actual;
  }
  if (actual === "hoy") {
    pintarHoy();
  }
  if (actual === "ajustes") {
    pintarAjustes();
  }
  window.scrollTo(0, 0);
}

function pintarHoy() {
  document.getElementById("fecha-hoy").textContent = formatoFecha.format(new Date());
}

function pintarAjustes() {
  document.getElementById("version").textContent = VERSION;
  document.getElementById("estado-conexion").textContent = navigator.onLine ? "Con conexión" : "Sin conexión";
  const controlado = "serviceWorker" in navigator && navigator.serviceWorker.controller;
  document.getElementById("estado-offline").textContent = controlado ? "Activo" : "Aún no activo";
}

document.getElementById("boton-ajustes").addEventListener("click", () => {
  location.hash = pantallaActual() === "ajustes" ? pantallaAnterior : "ajustes";
});

window.addEventListener("hashchange", mostrarPantalla);
window.addEventListener("online", pintarAjustes);
window.addEventListener("offline", pintarAjustes);

// Al volver a la app (por ejemplo, al día siguiente) se actualiza la fecha.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    mostrarPantalla();
  }
});

mostrarPantalla();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Sin service worker la app funciona igual, pero no sin conexión.
  });
}
