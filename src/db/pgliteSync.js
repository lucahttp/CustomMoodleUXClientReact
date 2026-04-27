/**
 * pgliteSync.js
 * Inicializa PGlite en WASM con persistencia local-first (IndexedDB VFS).
 * Expone la instancia PGlite de base de datos lista para consultar en el frontend.
 */

import { PGlite } from '@electric-sql/pglite';
import { electricSync } from '@electric-sql/pglite-sync';

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
      debug: false,
      extensions: {
        electric: electricSync()
      }
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
      } else {
         // Pequeña migración on-the-fly para la columna nueva
         await db.exec(`ALTER TABLE capitulos_libros ADD COLUMN IF NOT EXISTS content_html TEXT;`);
         await db.exec(`ALTER TABLE recursos ADD COLUMN IF NOT EXISTS content_html TEXT;`);
      }
    } catch (e) {
       console.warn("[PGlite] ⚠️ Fallo al chequear o insertar el Schema auto-generado:", e);
    }

    // Iniciar sincronización de tablas mediante shapes de ElectricSQL
    try {
      console.log("[PGlite] ⚡ Iniciando sincronización con ElectricSQL...");
      const syncUrl = 'http://localhost:3000/v1/shape';
      
      // Sincronizar recursos (incluye metadata, status y url de descarga)
      await db.electric.syncShapeToTable({
        shape: { 
          url: syncUrl,
          params: { table: 'recursos' }
        },
        table: 'recursos',
        primaryKey: ['id']
      });

      // Sincronizar resultados
      await db.electric.syncShapeToTable({
        shape: { 
          url: syncUrl,
          params: { table: 'transcripciones_video' }
        },
        table: 'transcripciones_video',
        primaryKey: ['id']
      });
      console.log("[PGlite] ⚡ Sync Shapes registradas exitosamente.");
    } catch(e) {
      console.warn("[PGlite] ⚠️ No se pudo inicializar la sincronización de Electric. ¿El servidor está corriendo?", e);
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
