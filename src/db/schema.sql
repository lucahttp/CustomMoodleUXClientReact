-- schema.sql
-- Este archivo define el esquema inicial para PGlite adaptado a OPFS y Global Search (FTS)

--------------------------------------------------------------------------------
-- 1. TABLA PRINCIPAL (METADATOS DE RECURSOS)
--------------------------------------------------------------------------------

-- Tabla Recursos
-- Almacena la metainformación de cada recurso (Videos y Libros).
-- PGlite se usa para búsquedas e índices, mientras que OPFS guarda los binarios.
CREATE TABLE recursos (
    id VARCHAR(255) PRIMARY KEY, -- ID original de Moodle (ej. 5530)
    curso_id VARCHAR(255) NOT NULL,
    titulo TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'video' | 'book'
    resumen TEXT,
    opfs_video_path TEXT, -- Ruta autogenerada al guardar el blob MP4
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--------------------------------------------------------------------------------
-- 2. TABLAS CHUNKED (FULL-TEXT SEARCH & DEEPLINKING)
--------------------------------------------------------------------------------

-- Tabla Transcripciones (Chunks de Video)
CREATE TABLE transcripciones_video (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(255) NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
    start_time VARCHAR(255) NOT NULL, -- Tiempo en el que inicia la frase (ej. 00:00:10.000)
    text_content TEXT NOT NULL,       -- Lo que realmente dijo el profesor
    fts_vector tsvector               -- Vector mágico compilado por Postgres
);

-- Tabla Capítulos (Chunks de Libro)
CREATE TABLE capitulos_libros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    libro_id VARCHAR(255) NOT NULL REFERENCES recursos(id) ON DELETE CASCADE,
    anchor_id TEXT,                 -- <h2 id="esto-es-el-anchor"> para deslizar la UI
    titulo_capitulo TEXT NOT NULL,  -- Título del subtítulo/capítulo
    text_content TEXT NOT NULL,     -- El cuerpo del texto para buscar dentro
    fts_vector tsvector             -- Vector mágico
);

--------------------------------------------------------------------------------
-- 3. ÍNDICES GIN PARA PERFORMANCE FTS (MUY IMPORTANTE)
--------------------------------------------------------------------------------

CREATE INDEX idx_fts_transcripciones ON transcripciones_video USING GIN (fts_vector);
CREATE INDEX idx_fts_capitulos_libros ON capitulos_libros USING GIN (fts_vector);

--------------------------------------------------------------------------------
-- 4. TRIGGERS AUTOMÁTICOS PARA ACTUALIZAR tsvector
--------------------------------------------------------------------------------

-- Para Videos:
CREATE OR REPLACE FUNCTION update_fts_transcripciones() RETURNS trigger AS $$
BEGIN
  -- Convertimos el tsvector utilizando diccionario 'spanish'. Le damos peso A ('máxima prioridad')
  NEW.fts_vector := setweight(to_tsvector('spanish', coalesce(NEW.text_content, '')), 'A');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fts_transcripciones BEFORE INSERT OR UPDATE ON transcripciones_video
FOR EACH ROW EXECUTE PROCEDURE update_fts_transcripciones();

-- Para Libros:
CREATE OR REPLACE FUNCTION update_fts_capitulos_libros() RETURNS trigger AS $$
BEGIN
  -- Damos prioridad ('A') a una coincidencia en el título del capítulo,
  -- y una menor prioridad ('B') si la coincidencia ocurre en el cuerpo del texto.
  NEW.fts_vector := 
    setweight(to_tsvector('spanish', coalesce(NEW.titulo_capitulo, '')), 'A') || 
    setweight(to_tsvector('spanish', coalesce(NEW.text_content, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fts_capitulos BEFORE INSERT OR UPDATE ON capitulos_libros
FOR EACH ROW EXECUTE PROCEDURE update_fts_capitulos_libros();
