/**
 * queries.js
 * Centraliza las consultas DML para la arquitectura PGlite + Electric.
 * Contiene el motor de Global Search unificado mediante FTS.
 */

/**
 * Busca simultáneamente en transcripciones de videos y capítulos de libros.
 * Utiliza websearch_to_tsquery para procesar queries estilo "orgánico" 
 * (ej., ignora tildes, usa diccionarios spanish, palabras reservadas).
 * Retorna además un snippet formateado HTML y una puntuación (rank).
 * 
 * @param {string} searchQuery - El string escrito por el usuario en la barra.
 * @returns {string} - Consulta SQL lista para ser usada en `db.query(sql, [searchQuery])`
 */
export const makeGlobalSearchQuery = () => `
    WITH search_query AS (
        SELECT websearch_to_tsquery('spanish', $1) AS query
    )
    SELECT * FROM (
        --- RAMA 1: Búsqueda en Transcripciones VTT
        SELECT 
            'video' AS source_type,
            r.id AS resource_id,
            r.titulo AS resource_title,
            t.start_time::text AS deep_link_ref, -- Start time exacto en string p/ UI
            
            -- Extraemos el pedacito de texto resaltado con <mark>. 35 palabras max.
            ts_headline(
                'spanish', 
                t.text_content, 
                sq.query, 
                'StartSel = <mark>, StopSel = </mark>, MaxWords=35, MinWords=15'
            ) AS snippet,
            
            -- Ranking BM25 clásico nativo en pg
            ts_rank(t.fts_vector, sq.query) AS rank
            
        FROM transcripciones_video t
        JOIN recursos r ON t.video_id = r.id
        CROSS JOIN search_query sq
        WHERE sq.query @@ t.fts_vector
        
        UNION ALL
        
        --- RAMA 2: Búsqueda en Libros HTML Fragmentados
        SELECT 
            'book' AS source_type,
            r.id AS resource_id,
            r.titulo || ' - ' || c.titulo_capitulo AS resource_title, -- Ej: Fisica II - Unidad 4
            c.anchor_id AS deep_link_ref, -- Ej: "header-4"
            
            ts_headline(
                'spanish', 
                c.text_content, 
                sq.query, 
                'StartSel = <mark>, StopSel = </mark>, MaxWords=35, MinWords=15'
            ) AS snippet,
            
            ts_rank(c.fts_vector, sq.query) AS rank
            
        FROM capitulos_libros c
        JOIN recursos r ON c.libro_id = r.id
        CROSS JOIN search_query sq
        WHERE sq.query @@ c.fts_vector
    ) combinados
    ORDER BY rank DESC
    LIMIT 50;
`;

/**
 * Busca filtrando por curso especifico.
 */
export const makeFilteredSearchQuery = (courseId) => `
    WITH search_query AS (
        SELECT websearch_to_tsquery('spanish', $1) AS query
    )
    SELECT * FROM (
        SELECT 
            'video' AS source_type,
            r.id AS resource_id,
            r.titulo AS resource_title,
            t.start_time::text AS deep_link_ref,
            ts_headline('spanish', t.text_content, sq.query, 'StartSel = <mark>, StopSel = </mark>, MaxWords=35, MinWords=15') AS snippet,
            ts_rank(t.fts_vector, sq.query) AS rank
        FROM transcripciones_video t
        JOIN recursos r ON t.video_id = r.id
        CROSS JOIN search_query sq
        WHERE sq.query @@ t.fts_vector AND r.curso_id = '${courseId}'
        
        UNION ALL
        
        SELECT 
            'book' AS source_type,
            r.id AS resource_id,
            r.titulo || ' - ' || c.titulo_capitulo AS resource_title,
            c.anchor_id AS deep_link_ref,
            ts_headline('spanish', c.text_content, sq.query, 'StartSel = <mark>, StopSel = </mark>, MaxWords=35, MinWords=15') AS snippet,
            ts_rank(c.fts_vector, sq.query) AS rank
        FROM capitulos_libros c
        JOIN recursos r ON c.libro_id = r.id
        CROSS JOIN search_query sq
        WHERE sq.query @@ c.fts_vector AND r.curso_id = '${courseId}'
    ) combinados
    ORDER BY rank DESC
    LIMIT 50;
`;

/**
 * Busca filtrando por un recurso (video o libro) específico.
 */
export const makeResourceSearchQuery = (resourceId) => `
    WITH search_query AS (
        SELECT websearch_to_tsquery('spanish', $1) AS query
    )
    SELECT * FROM (
        SELECT 
            'video' AS source_type,
            r.id AS resource_id,
            r.titulo AS resource_title,
            t.start_time::text AS deep_link_ref,
            ts_headline('spanish', t.text_content, sq.query, 'StartSel = <mark>, StopSel = </mark>, MaxWords=35, MinWords=15') AS snippet,
            ts_rank(t.fts_vector, sq.query) AS rank
        FROM transcripciones_video t
        JOIN recursos r ON t.video_id = r.id
        CROSS JOIN search_query sq
        WHERE sq.query @@ t.fts_vector AND r.id = '${resourceId}'
        
        UNION ALL
        
        SELECT 
            'book' AS source_type,
            r.id AS resource_id,
            r.titulo || ' - ' || c.titulo_capitulo AS resource_title,
            c.anchor_id AS deep_link_ref,
            ts_headline('spanish', c.text_content, sq.query, 'StartSel = <mark>, StopSel = </mark>, MaxWords=35, MinWords=15') AS snippet,
            ts_rank(c.fts_vector, sq.query) AS rank
        FROM capitulos_libros c
        JOIN recursos r ON c.libro_id = r.id
        CROSS JOIN search_query sq
        WHERE sq.query @@ c.fts_vector AND r.id = '${resourceId}'
    ) combinados
    ORDER BY rank DESC
    LIMIT 50;
`;

/**
 * Inserta un recurso de video y un bulk de sus transcripciones en la DB PGlite 
 * de manera transaccional. Esto disparará automáticamente los triggers internos 
 * "tsvector" definidos en tu `schema.sql`.
 * 
 * @param {any} pgliteDbInstance 
 * @param {object} metadata - { id, course_id, moodle_id, title, ... }
 * @param {Array} cues - [{ start_time, end_time, text_content }]
 */
export async function insertVideoAndCues(pgliteDbInstance, metadata, cues) {
    await pgliteDbInstance.transaction(async (tx) => {
        
        // 1. Insertamos o saltamos si existe el registro padre Video
        await tx.query(`
            INSERT INTO videos (id, course_id, moodle_id, title, opfs_video_path, opfs_vtt_path)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (moodle_id) DO UPDATE 
            SET title = EXCLUDED.title, 
                opfs_video_path = EXCLUDED.opfs_video_path;
        `, [
            metadata.id, metadata.course_id, metadata.moodle_id, 
            metadata.title, metadata.opfs_video_path, metadata.opfs_vtt_path
        ]);
        
        // 2. Insertamos la nueva tanda de transcripciones vinculándolas al padre.
        // NOTA: Para performance extrema real, esto puede optimizarse en PostgreSQL con 
        // sintaxis `unnest` o pg-format masivo. Pero para WASM local en chunk pequeño, el forloop funciona.
        
        const videoUUId = metadata.id; 
        
        // Limpiamos viejas primero por si es un re-procesamiento
        await tx.query('DELETE FROM transcripciones_video WHERE video_id = $1', [videoUUId]);

        for (const cue of cues) {
            await tx.query(`
                INSERT INTO transcripciones_video (video_id, start_time, end_time, text_content)
                VALUES ($1, $2, $3, $4)
            `, [videoUUId, cue.start_time, cue.end_time, cue.text_content]);
        }
    });
}

/**
 * Actualiza el HTML de un capítulo (por ejemplo, después de convertir Google Slides a SVG).
 */
export async function updateChapterHtml(pgliteDbInstance, libroId, anchorId, newHtml) {
    await pgliteDbInstance.query(`
        UPDATE capitulos_libros 
        SET content_html = $1
        WHERE libro_id = $2 AND anchor_id = $3
    `, [newHtml, libroId, anchorId]);
}
