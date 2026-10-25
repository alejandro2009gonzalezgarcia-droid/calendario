"use strict";

const VERSION = "0.2.0";
const PANTALLAS = ["hoy", "semana", "mes", "mi-semana", "ajustes"];

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

const formatoFechaHora = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

let pantallaAnterior = "hoy";
let copiaPreparada = null;
let datosListos = false;

const $ = (id) => document.getElementById(id);

/* ---------- Navegación ---------- */

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

  $("titulo").textContent = $("pantalla-" + actual).dataset.titulo;
  $("boton-ajustes").setAttribute("aria-pressed", String(actual === "ajustes"));

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

/* ---------- Avisos y confirmaciones ---------- */

let temporizadorAviso = null;

function avisar(texto) {
  const aviso = $("aviso");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove("visible"), 3500);
}

function confirmar(titulo, texto, textoBoton, peligroso) {
  const dialogo = $("dialogo");
  $("dialogo-titulo").textContent = titulo;
  $("dialogo-texto").textContent = texto;
  const aceptar = $("dialogo-aceptar");
  aceptar.textContent = textoBoton;
  aceptar.classList.toggle("peligro", Boolean(peligroso));
  dialogo.returnValue = "";
  return new Promise((resolver) => {
    dialogo.addEventListener("close", () => resolver(dialogo.returnValue === "aceptar"), { once: true });
    dialogo.showModal();
  });
}

/* ---------- Hoy ---------- */

function pintarHoy() {
  $("fecha-hoy").textContent = formatoFecha.format(new Date());
}

/* ---------- Ajustes ---------- */

async function pintarAjustes() {
  $("version").textContent = VERSION;
  $("estado-conexion").textContent = navigator.onLine ? "Con conexión" : "Sin conexión";
  const controlado = "serviceWorker" in navigator && navigator.serviceWorker.controller;
  $("estado-offline").textContent = controlado ? "Activo" : "Aún no activo";
  pintarPersistencia();

  if (!datosListos) {
    return;
  }

  try {
    const categorias = await BD.todos("categorias");
    categorias.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const lista = $("lista-categorias");
    lista.replaceChildren();
    if (categorias.length === 0) {
      const vacia = document.createElement("li");
      vacia.className = "fila";
      vacia.textContent = "No hay categorías.";
      lista.append(vacia);
    }
    categorias.forEach((categoria) => {
      const fila = document.createElement("li");
      fila.className = "fila fila-categoria";
      const punto = document.createElement("span");
      punto.className = "punto";
      punto.style.background = categoria.color;
      punto.setAttribute("aria-hidden", "true");
      const nombre = document.createElement("span");
      nombre.textContent = categoria.nombre;
      fila.append(punto, nombre);
      lista.append(fila);
    });

    const ultima = await BD.leerAjuste("ultimaCopia");
    $("ultima-copia").textContent = ultima ? formatoFechaHora.format(new Date(ultima)) : "Nunca";

    // La copia se prepara antes de pulsar el botón: iOS solo deja abrir
    // el menú de compartir justo después de tocar la pantalla.
    copiaPreparada = await BD.exportar();
  } catch (error) {
    avisar("No se han podido leer los datos. Cierra la app y vuelve a abrirla.");
  }
}

async function pintarPersistencia() {
  let texto = "No disponible";
  if (navigator.storage && navigator.storage.persisted) {
    try {
      texto = (await navigator.storage.persisted()) ? "Sí" : "No";
    } catch (error) {
      texto = "No disponible";
    }
  }
  $("estado-persistente").textContent = texto;
}

function nombreArchivoCopia() {
  const hoy = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  return "calendario-copia-" + hoy.getFullYear() + "-" + dos(hoy.getMonth() + 1) + "-" + dos(hoy.getDate()) + ".json";
}

async function exportarCopia() {
  if (!copiaPreparada) {
    avisar("Preparando la copia… Vuelve a pulsar en un momento.");
    return;
  }
  const ahora = new Date().toISOString();
  copiaPreparada.exportado = ahora;
  copiaPreparada.datos.ajustes = copiaPreparada.datos.ajustes
    .filter((fila) => fila.clave !== "ultimaCopia")
    .concat({ clave: "ultimaCopia", valor: ahora });
  const texto = JSON.stringify(copiaPreparada, null, 2);
  const nombre = nombreArchivoCopia();
  const candidatos = [
    new File([texto], nombre, { type: "application/json" }),
    new File([texto], nombre, { type: "text/plain" })
  ];
  const archivo = navigator.canShare ? candidatos.find((f) => navigator.canShare({ files: [f] })) : null;

  try {
    if (archivo) {
      await navigator.share({ files: [archivo] });
    } else {
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(candidatos[0]);
      enlace.download = nombre;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
    }
    await BD.guardarAjuste("ultimaCopia", ahora);
    avisar("Copia exportada.");
    pintarAjustes();
  } catch (error) {
    if (error && error.name === "AbortError") {
      avisar("Exportación cancelada.");
    } else {
      avisar("No se ha podido exportar la copia.");
    }
  }
}

async function importarCopia(archivo) {
  let copia;
  try {
    copia = JSON.parse(await archivo.text());
  } catch (error) {
    avisar("El archivo no es una copia válida.");
    return;
  }
  const problema = BD.validarCopia(copia);
  if (problema) {
    avisar(problema);
    return;
  }

  const fecha = copia.exportado ? formatoFechaHora.format(new Date(copia.exportado)) : "fecha desconocida";
  const ok = await confirmar(
    "¿Importar esta copia?",
    "Se sustituirán todos los datos actuales por los de la copia del " + fecha + ". Esto no se puede deshacer.",
    "Importar",
    true
  );
  if (!ok) {
    return;
  }
  try {
    await BD.importar(copia);
    avisar("Copia importada.");
  } catch (error) {
    avisar("No se ha podido importar. Tus datos no han cambiado.");
  }
  pintarAjustes();
}

async function borrarTodo() {
  const ok = await confirmar(
    "¿Borrar todos los datos?",
    "Se borrarán tu semana tipo, eventos, tareas y categorías. Exporta antes una copia si quieres conservarlos.",
    "Borrar todo",
    true
  );
  if (!ok) {
    return;
  }
  try {
    await BD.borrarTodo();
    avisar("Datos borrados.");
  } catch (error) {
    avisar("No se han podido borrar los datos.");
  }
  pintarAjustes();
}

/* ---------- Eventos ---------- */

$("boton-ajustes").addEventListener("click", () => {
  location.hash = pantallaActual() === "ajustes" ? pantallaAnterior : "ajustes";
});

$("boton-exportar").addEventListener("click", exportarCopia);
$("boton-importar").addEventListener("click", () => $("archivo-importar").click());
$("archivo-importar").addEventListener("change", (evento) => {
  const archivo = evento.target.files[0];
  evento.target.value = "";
  if (archivo) {
    importarCopia(archivo);
  }
});
$("boton-borrar").addEventListener("click", borrarTodo);

window.addEventListener("hashchange", mostrarPantalla);
window.addEventListener("online", pintarAjustes);
window.addEventListener("offline", pintarAjustes);

// Al volver a la app (por ejemplo, al día siguiente) se actualiza la pantalla.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    mostrarPantalla();
  }
});

/* ---------- Arranque ---------- */

async function iniciar() {
  mostrarPantalla();

  try {
    await BD.preparar();
    datosListos = true;
  } catch (error) {
    avisar("No se ha podido abrir el almacenamiento de la app.");
  }

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  if (pantallaActual() === "ajustes") {
    pintarAjustes();
  }
}

iniciar();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Sin service worker la app funciona igual, pero no sin conexión.
  });
}
