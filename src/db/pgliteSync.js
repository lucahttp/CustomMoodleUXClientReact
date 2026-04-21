/**
 * pgliteSync.js
 * Inicializa PGlite en WASM con persistencia local-first (IndexedDB VFS).
 * Expone la instancia PGlite de base de datos lista para consultar en el frontend.
 */

import { PGlite } from '@electric-sql/pglite';

// Referencia global al singleton de la DB para consumir en toda la app react
import schemaRaw from './schema.sql?raw';

let globalPgliteInstance = null;

/**
 * Inicializa PGlite con persistencia Local en IndexedDB.
 * Local-first: no depende de ningún servidor externo.
 */
export async function initPGlite() {
  if (globalPgliteInstance) {
    console.warn("PGlite ya fue inicializado.");
    return globalPgliteInstance;
  }

  try {
    console.log("[PGlite] Inicializando worker WASM y Storage (idb://moodle-offline-store)...");
    
    const db = await PGlite.create({
      dataDir: 'idb://moodle-offline-store',
      debug: false 
    });

    console.log("[PGlite] ¡Listo! Modo local-first activo.");

    globalPgliteInstance = db;
    
    // Bootstrap Schema si la base de datos es nueva
    try {
      const checker = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='recursos';`);
      if (checker.rows.length === 0) {
         console.log("[PGlite] 🔧 Base de datos limpia detectada. Inyectando Schema DDL FTS...");
         await db.exec(schemaRaw);
         console.log("[PGlite] ✅ Schema migrado estáticamente con éxito.");
      }
    } catch (e) {
       console.warn("[PGlite] ⚠️ Fallo al chequear o insertar el Schema auto-generado:", e);
    }

    return globalPgliteInstance;

  } catch (err) {
    console.error(`[PGlite] Falló una crisis fatal iniciando la BBDD wasm:`, err);
    throw err;
  }
}

/**
 * Devuelve la BBDD, inicializándola 'on the fly' si el desarrollador no lo hizo antes
 * @returns {Promise<PGlite>}
 */
export async function getPgliteInstance() {
   if (!globalPgliteInstance) {
       await initPGlite();
   }
   return globalPgliteInstance;
}

/**
 * Un hook/helper útil para correr el schema.sql crudo por sobre la DB limpia
 * si nunca fue migrada.
 */
export async function runInitialSchema(sqlRawString) {
    const db = await getPgliteInstance();
    try {
        console.log("[DML] Ejecutando esquema inicial DDL...");
        await db.exec(sqlRawString);
        console.log("[DML] Éxito. Migración inicial OK.");
    } catch(e) {
        console.error("[DML] Fallo inyectando Schema SQL nativo en PGlite:", e);
    }
}
