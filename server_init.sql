-- server_init.sql
-- Este script inicializa PGMQ y los triggers en el servidor para el worker de Rust.

-- 1. Habilitar extensiones necesarias (PGMQ se instala vía 01-pgmq.sql)
-- CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

-- 2. Crear colas de PGMQ
SELECT pgmq.create('video_downloads');
SELECT pgmq.create('video_transcriptions');

-- 3. Función del Trigger para Encolar Descargas
CREATE OR REPLACE FUNCTION enqueue_video_download()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el status es 'no_descargado' y tiene una URL de moodle
    IF (NEW.status = 'no_descargado' AND NEW.moodle_url IS NOT NULL) THEN
        -- Encolar en PGMQ usando formato JSON compatible con el worker
        PERFORM pgmq.send(
            'video_downloads',
            jsonb_build_object(
                'recurso_id', NEW.id,
                'url', NEW.moodle_url
            )
        );
        
        -- Opcional: Actualizar status a 'queued' para evitar re-encolados si el trigger se dispara de nuevo
        -- Pero NEW.status es lo que viene de Electric, si lo cambiamos aquí 
        -- Electric podría intentar sincronizarlo de vuelta si no tenemos cuidado.
        -- Mejor dejar que el worker lo cambie a 'downloading'.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear el trigger en la tabla recursos
-- NOTA: La tabla 'recursos' será creada por Electric o debe existir previamente.
-- Para asegurar que este script no falle, creamos la tabla si no existe (schema simplificado para el trigger).
CREATE TABLE IF NOT EXISTS recursos (
    id VARCHAR(255) PRIMARY KEY,
    curso_id VARCHAR(255) NOT NULL,
    titulo TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    resumen TEXT,
    fecha TEXT,
    moodle_url TEXT,
    rustfs_path TEXT,
    status VARCHAR(50) DEFAULT 'no_descargado',
    content_html TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transcripciones_video (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(255) NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
    start_time VARCHAR(255) NOT NULL,
    text_content TEXT NOT NULL,
    fts_vector tsvector
);

CREATE TABLE IF NOT EXISTS capitulos_libros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    libro_id VARCHAR(255) NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
    anchor_id TEXT,
    titulo_capitulo TEXT NOT NULL,
    text_content TEXT NOT NULL,
    content_html TEXT,
    fts_vector tsvector
);

CREATE INDEX IF NOT EXISTS idx_fts_transcripciones ON transcripciones_video USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS idx_fts_capitulos_libros ON capitulos_libros USING GIN (fts_vector);

CREATE OR REPLACE FUNCTION update_fts_transcripciones() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector := setweight(to_tsvector('spanish', coalesce(NEW.text_content, '')), 'A');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fts_transcripciones ON transcripciones_video;
CREATE TRIGGER trg_fts_transcripciones BEFORE INSERT OR UPDATE ON transcripciones_video
FOR EACH ROW EXECUTE PROCEDURE update_fts_transcripciones();

CREATE OR REPLACE FUNCTION update_fts_capitulos_libros() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector := 
    setweight(to_tsvector('spanish', coalesce(NEW.titulo_capitulo, '')), 'A') || 
    setweight(to_tsvector('spanish', coalesce(NEW.text_content, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fts_capitulos ON capitulos_libros;
CREATE TRIGGER trg_fts_capitulos BEFORE INSERT OR UPDATE ON capitulos_libros
FOR EACH ROW EXECUTE PROCEDURE update_fts_capitulos_libros();

DROP TRIGGER IF EXISTS trg_enqueue_download ON recursos;
CREATE TRIGGER trg_enqueue_download
AFTER INSERT OR UPDATE OF status ON recursos
FOR EACH ROW
EXECUTE FUNCTION enqueue_video_download();
