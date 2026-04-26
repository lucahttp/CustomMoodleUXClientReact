-- server_init.sql
-- Este script inicializa PGMQ y los triggers en el servidor para el worker de Rust.

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

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
    curso_id VARCHAR(255),
    titulo TEXT,
    tipo VARCHAR(50),
    moodle_url TEXT,
    rustfs_path TEXT,
    status VARCHAR(50) DEFAULT 'no_descargado'
);

DROP TRIGGER IF EXISTS trg_enqueue_download ON recursos;
CREATE TRIGGER trg_enqueue_download
AFTER INSERT OR UPDATE OF status ON recursos
FOR EACH ROW
EXECUTE FUNCTION enqueue_video_download();
