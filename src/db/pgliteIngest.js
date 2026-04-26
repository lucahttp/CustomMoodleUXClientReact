/**
 * pgliteIngest.js
 * Centraliza la ingestión (escritura) de datos complejos provenientes del proveedor 
 * Moodle (Videos y Libros) hacia PGlite y Origin Private File System (OPFS).
 * @module
 */

import { getPgliteInstance } from './pgliteSync';
import { saveFileToOPFS } from './opfs';
import { parseBookContent, inlineSVGsInChapters } from '../utils/bookParser';

/**
 * Guarda una grabación Zoom en OPFS y desgrana el texto VTT en fragmentos
 * indexables en PGlite para que la búsqueda SQL por relevancia funcione.
 * 
 * ¿Por qué fragmentar?
 * Si agrupáramos 2 horas de VTT en un solo insert, el motor FTS perdería
 * exactitud al rankear y no podría enlazar el minuto exacto donde ocurre la frase.
 *
 * @param {number|string} resourceId ID Único de recurso Moodle
 * @param {number|string} courseId ID Único de la Materia
 * @param {string} title Nombre de la clase grabada
 * @param {string} summary Resumen de la clase o vacio
 * @param {Blob} videoBlob Archivo en crudo de formato mp4
 * @param {string} vttText Texto íntegro del subtítulo generado por Vibe
 */
export async function ingestZoomRecording(resourceId, courseId, title, videoBlob, vttText, summary = "") {
    const db = await getPgliteInstance();
    
    // 1. Storage Zero-Copy: Almacenar Blob pesado en OPFS de forma asíncrona.
    let opfsVideoPath = null;
    if (videoBlob) {
        // En base a reglas de consistencia de OPFS, nombramos el chunk
        opfsVideoPath = await saveFileToOPFS(`zoom-${resourceId}.mp4`, videoBlob);
    }

    console.log(`[Ingest] 📥 Escribiendo metadatos Zoom (ID: ${resourceId}) en PGlite...`);

    // 2. Metadatos Raíz
    await db.query(`
      INSERT INTO recursos (id, curso_id, titulo, tipo, resumen, opfs_video_path)
      VALUES ($1, $2, $3, 'video', $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        curso_id = EXCLUDED.curso_id,
        titulo = EXCLUDED.titulo,
        resumen = EXCLUDED.resumen,
        opfs_video_path = COALESCE(EXCLUDED.opfs_video_path, recursos.opfs_video_path)
    `, [String(resourceId), String(courseId), title, summary, opfsVideoPath]);

    // 3. FTS Chunking: Parsear VTT y construir tabla de índices secundarios
    if (vttText) {
       console.log(`[Ingest] ⚙️ Desgranando VTT para FTS exacto...`);
       // Purga previa per-ID para evitar duplicados en reprocesamientos
       await db.query(`DELETE FROM transcripciones_video WHERE video_id = $1`, [String(resourceId)]);

       const vttRegex = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/;
       const blocks = vttText.split(/\n\s*\n/);
       
       const insertBatch = [];

       for (const block of blocks) {
           const lines = block.split('\n');
           const match = lines[0].match(vttRegex) || lines[1]?.match(vttRegex); 
           
           if (match) {
              const [ , startTimeStr ] = match;
              const usefulLines = lines.filter(l => !l.match(vttRegex) && !l.match(/WEBVTT/) && l.trim().length > 0);
              const textContent = usefulLines.join(' ');
              
              if (textContent.trim().length > 0) {
                   insertBatch.push([String(resourceId), startTimeStr, textContent]);
              }
           }
       }

       if (insertBatch.length > 0) {
           console.log(`[Ingest] 📝 Insertando ${insertBatch.length} timestamps fraccionados de la clase...`);
           await db.transaction(async (tx) => {
                for (const row of insertBatch) {
                     await tx.query(
                         `INSERT INTO transcripciones_video (video_id, start_time, text_content) VALUES ($1, $2, $3)`, 
                         row
                     );
                }
           });
       }
    }
}

/**
 * Agrega o actualiza un libro en PGlite, fragmentando su contenido HTML
 * en capítulos indexables. Usa DOMParser en `bookParser.js` para limpiar estilos sucios de Moodle.
 * 
 * ¿Por qué fragmentar un libro?
 * Permite buscar un concepto, e ir a la subpágina `anchor_id` especifica
 * en lugar de llevar al usuario ciego al título del libro genérico.
 */
export async function ingestMoodleBook(resourceId, courseId, endpoint, title, htmlContent, summary = "") {
   const db = await getPgliteInstance();
   console.log(`[Ingest] 📥 Ingiriendo Moodle Book (ID: ${resourceId}) en PGlite...`);

    await db.query(`
      INSERT INTO recursos (id, curso_id, titulo, tipo, resumen, content_html)
      VALUES ($1, $2, $3, 'book', $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        curso_id = EXCLUDED.curso_id,
        titulo = EXCLUDED.titulo,
        resumen = EXCLUDED.resumen,
        content_html = EXCLUDED.content_html
    `, [String(resourceId), String(courseId), title, summary, htmlContent]);

   // Purga
   await db.query(`DELETE FROM capitulos_libros WHERE libro_id = $1`, [String(resourceId)]);

   // Parser aislado y limpio de side-effects web
   let parsedData = parseBookContent(htmlContent, endpoint);

   if (parsedData.chapters && parsedData.chapters.length > 0) {
      console.log(`[Ingest] 🎨 Inlining SVGs for ${parsedData.chapters.length} chapters...`);
      parsedData.chapters = await inlineSVGsInChapters(parsedData.chapters);

      console.log(`[Ingest] 📝 Insertando ${parsedData.chapters.length} capitulos procesados...`);
      await db.transaction(async (tx) => {
          for (const chap of parsedData.chapters) {
              // Postgres tsvector requiere texto plano idealmente, extraemos las etiquetas HTML visuales ruidosas
              const plainTextContent = chap.content.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ');
              await tx.query(
                  `INSERT INTO capitulos_libros (libro_id, anchor_id, titulo_capitulo, text_content, content_html) VALUES ($1, $2, $3, $4, $5)`, 
                  [String(resourceId), chap.id, chap.title, plainTextContent, chap.content]
              );
          }
      });
   }
}
