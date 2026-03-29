/**
 * pgliteSync.js
 * Inicializa PGlite en WASM con sincronización activa hacia ElectricSQL.
 * Expone la instancia PGlite de base de datos lista para consultar en el frontend.
 */

import { PGlite } from '@electric-sql/pglite';
import { electricSync } from '@electric-sql/pglite-sync';

// Opcional: Para ejecutar las queries puras de Postgres usando tagged templates (sql\``)
// import { pgliteDialect } from 'drizzle-orm/pglite'; 
// import { drizzle } from 'drizzle-orm/pglite';

// Referencia global al singleton de la DB para consumir en toda la app react
import schemaRaw from './schema.sql?raw';

let globalPgliteInstance = null;
let globalSyncPlugin = null;

/**
 * Inicializa formalmente PGlite con persistencia Local en IndexedDB y 
 * agrega la extensión oficial de Sync de ElectricSQL.
 */
export async function initPGlite() {
  if (globalPgliteInstance) {
    console.warn("PGlite ya fue inicializado.");
    return globalPgliteInstance;
  }

  try {
    console.log("[PGlite] Inicializando worker WASM y Storage (idb://moodle-offline-store)...");
    
    // NOTA: 'idb://moodle-offline-store' asegura persistencia en el browser Storage VFS (Virtual File System)
    const db = await PGlite.create({
      dataDir: 'idb://moodle-offline-store',
      extensions: {
        sync: electricSync(),
      },
      // opcionales de performance/caché
      debug: false 
    });

    console.log("[PGlite] ¡Listo! Conectando a ElectricSQL daemon (WS local por ahora).");
    
    // Conectamos con el backend. Por ahora omitido o dejado como param dummy, 
    // hasta definir el host de producción / local de Electric.
    // El puerto 5133 es el WS por defecto de ElectricSQL local.
    let sync = null;
    try {
        sync = await db.sync.sync({
            url: 'ws://localhost:5133', 
        });
    } catch (e) {
        console.warn("[PGlite] ⚠️ No se detectó servidor ElectricSQL (ws://localhost:5133). PGlite funcionará en modo puramente local (Local-First sin sincronización push/pull).");
    }

    globalPgliteInstance = db;
    globalSyncPlugin = sync;
    
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

    return {
        db: globalPgliteInstance,
        sync: globalSyncPlugin
    };

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
