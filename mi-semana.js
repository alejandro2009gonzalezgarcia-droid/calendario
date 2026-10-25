"use strict";

// Pantalla "Mi semana": bloques fijos que se repiten cada semana.
// Cada bloque pertenece a un solo día: { id, dia (1 = lunes … 7 = domingo), inicio "HH:MM", fin "HH:MM", titulo, categoriaId }.

const DIAS = [
  { n: 1, corto: "L", nombre: "Lunes" },
  { n: 2, corto: "M", nombre: "Martes" },
  { n: 3, corto: "X", nombre: "Miércoles" },
  { n: 4, corto: "J", nombre: "Jueves" },
  { n: 5, corto: "V", nombre: "Viernes" },
  { n: 6, corto: "S", nombre: "Sábado" },
  { n: 7, corto: "D", nombre: "Domingo" }
];

const COLOR_SIN_CATEGORIA = "#8a8f98";

let diaElegido = diaDeHoy();
let bloqueEditando = null;

function diaDeHoy() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function nombreDia(n) {
  return DIAS.find((d) => d.n === n).nombre;
}

function nuevoId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function ordenarBloques(lista) {
  return lista.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin));
}

async function leerCategorias() {
  const categorias = await BD.todos("categorias");
  return categorias.sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

/* ---------- Pintar la pantalla ---------- */

async function pintarMiSemana() {
  let bloques;
  let categorias;
  try {
    [bloques, categorias] = await Promise.all([BD.todos("bloques"), leerCategorias()]);
  } catch (error) {
    avisar("No se han podido leer tus bloques.");
    return;
  }
  const porId = new Map(categorias.map((c) => [c.id, c]));

  // Selector de días
  const selector = $("selector-dias");
  selector.replaceChildren();
  DIAS.forEach((dia) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "chip-dia";
    boton.dataset.dia = String(dia.n);
    boton.setAttribute("aria-pressed", String(dia.n === diaElegido));
    const cuantos = bloques.filter((b) => b.dia === dia.n).length;
    boton.setAttribute("aria-label", dia.nombre + (cuantos === 0 ? ", sin bloques" : cuantos === 1 ? ", 1 bloque" : ", " + cuantos + " bloques"));
    const letra = document.createElement("span");
    letra.textContent = dia.corto;
    const marca = document.createElement("span");
    marca.className = "marca-dia";
    marca.classList.toggle("oculta", cuantos === 0);
    boton.append(letra, marca);
    selector.append(boton);
  });

  $("titulo-dia").textContent = nombreDia(diaElegido);

  // Lista del día
  const delDia = ordenarBloques(bloques.filter((b) => b.dia === diaElegido));
  const lista = $("lista-bloques");
  lista.replaceChildren();
  lista.hidden = delDia.length === 0;
  $("bloques-vacio").hidden = delDia.length > 0;
  $("boton-copiar-dia").disabled = delDia.length === 0;

  delDia.forEach((bloque) => {
    const categoria = porId.get(bloque.categoriaId);
    const item = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "bloque";
    boton.dataset.id = bloque.id;

    const color = document.createElement("span");
    color.className = "bloque-color";
    color.style.background = categoria ? categoria.color : COLOR_SIN_CATEGORIA;
    color.setAttribute("aria-hidden", "true");

    const horas = document.createElement("span");
    horas.className = "bloque-horas";
    horas.textContent = bloque.inicio + "–" + bloque.fin;

    const textos = document.createElement("span");
    textos.className = "bloque-textos";
    const titulo = document.createElement("span");
    titulo.className = "bloque-titulo";
    titulo.textContent = bloque.titulo;
    const cat = document.createElement("span");
    cat.className = "bloque-categoria";
    cat.textContent = categoria ? categoria.nombre : "Sin categoría";
    textos.append(titulo, cat);

    boton.append(color, horas, textos);
    item.append(boton);
    lista.append(item);
  });
}

/* ---------- Formulario de bloque ---------- */

function crearCasillasDias(contenedor, nombre, marcados, excluir) {
  contenedor.replaceChildren();
  DIAS.forEach((dia) => {
    if (dia.n === excluir) {
      return;
    }
    const etiqueta = document.createElement("label");
    etiqueta.className = "casilla-dia";
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.name = nombre;
    casilla.value = String(dia.n);
    casilla.checked = marcados.includes(dia.n);
    const texto = document.createElement("span");
    texto.textContent = dia.corto;
    casilla.setAttribute("aria-label", dia.nombre);
    etiqueta.append(casilla, texto);
    contenedor.append(etiqueta);
  });
}

async function abrirFormularioBloque(bloque) {
  bloqueEditando = bloque || null;
  const form = $("form-bloque");
  form.reset();
  $("error-bloque").textContent = "";

  let categorias = [];
  try {
    categorias = await leerCategorias();
  } catch (error) {
    avisar("No se han podido leer las categorías.");
  }
  const select = form.elements.categoria;
  select.replaceChildren();
  categorias.forEach((c) => {
    const opcion = document.createElement("option");
    opcion.value = c.id;
    opcion.textContent = c.nombre;
    select.append(opcion);
  });

  if (bloque) {
    $("bloque-titulo-dialogo").textContent = "Editar bloque · " + nombreDia(bloque.dia);
    form.elements.titulo.value = bloque.titulo;
    form.elements.inicio.value = bloque.inicio;
    form.elements.fin.value = bloque.fin;
    if (categorias.some((c) => c.id === bloque.categoriaId)) {
      select.value = bloque.categoriaId;
    }
    $("campo-dias").hidden = true;
    $("bloque-eliminar").hidden = false;
  } else {
    $("bloque-titulo-dialogo").textContent = "Nuevo bloque";
    $("campo-dias").hidden = false;
    crearCasillasDias($("bloque-dias"), "dias", [diaElegido], null);
    $("bloque-eliminar").hidden = true;
  }

  $("dialogo-bloque").showModal();
}

function cerrarFormularioBloque() {
  $("dialogo-bloque").close();
  bloqueEditando = null;
}

async function guardarBloque(evento) {
  evento.preventDefault();
  const form = $("form-bloque");
  const titulo = form.elements.titulo.value.trim();
  const inicio = form.elements.inicio.value;
  const fin = form.elements.fin.value;
  const categoriaId = form.elements.categoria.value;
  const error = $("error-bloque");

  let fallo = null;
  let campo = null;
  if (!titulo) {
    fallo = "Escribe un título.";
    campo = form.elements.titulo;
  } else if (!inicio || !fin) {
    fallo = "Indica la hora de inicio y la de fin.";
    campo = inicio ? form.elements.fin : form.elements.inicio;
  } else if (fin <= inicio) {
    fallo = "La hora de fin debe ser posterior a la de inicio (los bloques no pueden pasar de medianoche).";
    campo = form.elements.fin;
  }

  let dias = [];
  if (!fallo && !bloqueEditando) {
    dias = Array.from(form.querySelectorAll('input[name="dias"]:checked')).map((c) => Number(c.value));
    if (dias.length === 0) {
      fallo = "Marca al menos un día.";
    }
  }

  if (fallo) {
    error.textContent = fallo;
    if (campo) {
      campo.focus();
    }
    return;
  }

  try {
    if (bloqueEditando) {
      await BD.guardar("bloques", { ...bloqueEditando, titulo, inicio, fin, categoriaId });
    } else {
      await BD.guardarVarios("bloques", dias.map((dia) => ({ id: nuevoId(), dia, inicio, fin, titulo, categoriaId })));
    }
  } catch (e) {
    error.textContent = "No se ha podido guardar. Inténtalo de nuevo.";
    return;
  }

  const eranVarios = !bloqueEditando && dias.length > 1;
  cerrarFormularioBloque();
  avisar(eranVarios ? "Bloque añadido a " + dias.length + " días." : "Bloque guardado.");
  pintarMiSemana();
}

async function eliminarBloque() {
  const bloque = bloqueEditando;
  if (!bloque) {
    return;
  }
  const ok = await confirmar(
    "¿Eliminar este bloque?",
    "Se eliminará «" + bloque.titulo + "» del " + nombreDia(bloque.dia).toLowerCase() + ". Los demás días no cambian.",
    "Eliminar",
    true
  );
  if (!ok) {
    return;
  }
  try {
    await BD.borrar("bloques", bloque.id);
  } catch (e) {
    avisar("No se ha podido eliminar.");
    return;
  }
  cerrarFormularioBloque();
  avisar("Bloque eliminado.");
  pintarMiSemana();
}

/* ---------- Copiar un día a otros ---------- */

function abrirCopiarDia() {
  $("copiar-titulo").textContent = "Copiar el " + nombreDia(diaElegido).toLowerCase() + " a…";
  $("error-copiar").textContent = "";
  crearCasillasDias($("copiar-dias"), "destino", [], diaElegido);
  $("dialogo-copiar").showModal();
}

async function copiarDia(evento) {
  evento.preventDefault();
  const destinos = Array.from($("copiar-dias").querySelectorAll("input:checked")).map((c) => Number(c.value));
  if (destinos.length === 0) {
    $("error-copiar").textContent = "Marca al menos un día.";
    return;
  }
  try {
    const todos = await BD.todos("bloques");
    const origen = todos.filter((b) => b.dia === diaElegido);
    const aBorrar = todos.filter((b) => destinos.includes(b.dia)).map((b) => b.id);
    const nuevos = [];
    destinos.forEach((dia) => {
      origen.forEach((b) => nuevos.push({ ...b, id: nuevoId(), dia }));
    });
    await BD.sustituirVarios("bloques", aBorrar, nuevos);
  } catch (e) {
    $("error-copiar").textContent = "No se ha podido copiar. No ha cambiado nada.";
    return;
  }
  $("dialogo-copiar").close();
  avisar("Copiado a " + destinos.length + (destinos.length === 1 ? " día." : " días."));
  pintarMiSemana();
}

/* ---------- Conexión de botones (lo llama app.js al arrancar) ---------- */

function prepararMiSemana() {
  $("selector-dias").addEventListener("click", (evento) => {
    const boton = evento.target.closest(".chip-dia");
    if (boton) {
      diaElegido = Number(boton.dataset.dia);
      pintarMiSemana();
    }
  });

  $("lista-bloques").addEventListener("click", async (evento) => {
    const boton = evento.target.closest(".bloque");
    if (!boton) {
      return;
    }
    try {
      const todos = await BD.todos("bloques");
      const bloque = todos.find((b) => b.id === boton.dataset.id);
      if (bloque) {
        abrirFormularioBloque(bloque);
      }
    } catch (e) {
      avisar("No se ha podido abrir el bloque.");
    }
  });

  $("boton-nuevo-bloque").addEventListener("click", () => abrirFormularioBloque(null));
  $("form-bloque").addEventListener("submit", guardarBloque);
  $("bloque-cancelar").addEventListener("click", cerrarFormularioBloque);
  $("bloque-eliminar").addEventListener("click", eliminarBloque);

  $("boton-copiar-dia").addEventListener("click", abrirCopiarDia);
  $("form-copiar").addEventListener("submit", copiarDia);
  $("copiar-cancelar").addEventListener("click", () => $("dialogo-copiar").close());
}
