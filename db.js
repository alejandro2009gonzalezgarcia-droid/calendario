"use strict";

// Almacenamiento de datos en el propio iPhone (IndexedDB).
// Nunca se guardan datos personales en el código.

const BD_NOMBRE = "calendario";
const BD_VERSION = 1;
const ALMACENES = ["categorias", "bloques", "eventos", "periodos", "ajustes"];
const FORMATO_COPIA = 1;

const CATEGORIAS_INICIALES = [
  { id: "cat-clase", nombre: "Clase", color: "#3b6fb6", orden: 1 },
  { id: "cat-estudio", nombre: "Estudio", color: "#7a4fc4", orden: 2 },
  { id: "cat-deporte", nombre: "Deporte", color: "#2e9e6a", orden: 3 },
  { id: "cat-descanso", nombre: "Descanso", color: "#8a8f98", orden: 4 },
  { id: "cat-compromiso", nombre: "Compromiso", color: "#e4573d", orden: 5 },
  { id: "cat-personal", nombre: "Personal", color: "#d99a1e", orden: 6 }
];

let conexion = null;

function promesa(peticion) {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

function abrirBD() {
  if (conexion) {
    return Promise.resolve(conexion);
  }
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BD_NOMBRE, BD_VERSION);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      ALMACENES.forEach((nombre) => {
        if (!bd.objectStoreNames.contains(nombre)) {
          bd.createObjectStore(nombre, { keyPath: nombre === "ajustes" ? "clave" : "id" });
        }
      });
    };
    peticion.onsuccess = () => {
      conexion = peticion.result;
      conexion.onversionchange = () => {
        conexion.close();
        conexion = null;
      };
      resolver(conexion);
    };
    peticion.onerror = () => rechazar(peticion.error);
    peticion.onblocked = () => rechazar(new Error("La base de datos está bloqueada. Cierra la app y vuelve a abrirla."));
  });
}

function transaccion(almacenes, modo) {
  return abrirBD().then((bd) => bd.transaction(almacenes, modo));
}

function finTransaccion(tx) {
  return new Promise((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error || new Error("Operación cancelada"));
  });
}

const BD = {
  async todos(almacen) {
    const tx = await transaccion([almacen], "readonly");
    return promesa(tx.objectStore(almacen).getAll());
  },

  async guardar(almacen, objeto) {
    const tx = await transaccion([almacen], "readwrite");
    tx.objectStore(almacen).put(objeto);
    return finTransaccion(tx);
  },

  async borrar(almacen, id) {
    const tx = await transaccion([almacen], "readwrite");
    tx.objectStore(almacen).delete(id);
    return finTransaccion(tx);
  },

  async leerAjuste(clave) {
    const tx = await transaccion(["ajustes"], "readonly");
    const fila = await promesa(tx.objectStore("ajustes").get(clave));
    return fila ? fila.valor : undefined;
  },

  guardarAjuste(clave, valor) {
    return BD.guardar("ajustes", { clave, valor });
  },

  // Primera apertura: crea las categorías predefinidas una sola vez.
  async preparar() {
    const iniciada = await BD.leerAjuste("iniciada");
    if (iniciada) {
      return;
    }
    const tx = await transaccion(["categorias", "ajustes"], "readwrite");
    CATEGORIAS_INICIALES.forEach((categoria) => tx.objectStore("categorias").put(categoria));
    tx.objectStore("ajustes").put({ clave: "iniciada", valor: new Date().toISOString() });
    return finTransaccion(tx);
  },

  async exportar() {
    const datos = {};
    for (const almacen of ALMACENES) {
      datos[almacen] = await BD.todos(almacen);
    }
    return {
      app: "calendario",
      formato: FORMATO_COPIA,
      exportado: new Date().toISOString(),
      datos
    };
  },

  // Comprueba que un archivo es una copia válida de esta app. Devuelve un texto de error o null.
  validarCopia(copia) {
    if (!copia || typeof copia !== "object" || copia.app !== "calendario") {
      return "El archivo no es una copia de esta app.";
    }
    if (typeof copia.formato !== "number" || copia.formato > FORMATO_COPIA) {
      return "La copia es de una versión más nueva de la app. Actualiza la app y vuelve a intentarlo.";
    }
    if (!copia.datos || typeof copia.datos !== "object") {
      return "La copia está incompleta.";
    }
    for (const almacen of ALMACENES) {
      const lista = copia.datos[almacen];
      if (lista === undefined) {
        continue;
      }
      if (!Array.isArray(lista)) {
        return "La copia está dañada (" + almacen + ").";
      }
      const clave = almacen === "ajustes" ? "clave" : "id";
      if (!lista.every((fila) => fila && typeof fila === "object" && typeof fila[clave] === "string")) {
        return "La copia está dañada (" + almacen + ").";
      }
    }
    return null;
  },

  // Sustituye todos los datos por los de la copia, en una sola operación:
  // si algo falla, no se borra nada.
  async importar(copia) {
    const tx = await transaccion(ALMACENES, "readwrite");
    ALMACENES.forEach((almacen) => {
      const tienda = tx.objectStore(almacen);
      tienda.clear();
      (copia.datos[almacen] || []).forEach((fila) => tienda.put(fila));
    });
    tx.objectStore("ajustes").put({ clave: "iniciada", valor: new Date().toISOString() });
    return finTransaccion(tx);
  },

  async borrarTodo() {
    const tx = await transaccion(ALMACENES, "readwrite");
    ALMACENES.forEach((almacen) => tx.objectStore(almacen).clear());
    await finTransaccion(tx);
    return BD.preparar();
  }
};
