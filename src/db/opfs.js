/**
 * opfs.js
 * Módulo para interactuar con el Origin Private File System (OPFS).
 * Se utiliza para no inflar la base de datos PGlite con archivos BLOB pesados.
 */

/**
 * Guarda un archivo binario o de texto dentro del OPFS.
 * @param {string} filename - El nombre del archivo a guardar (ej. "video-123.mp4")
 * @param {Blob | Uint8Array | string} content - El contenido crudo
 * @returns {Promise<string>} La ruta/referencia única utilizada
 */
export async function saveFileToOPFS(filename, content) {
    try {
        // Obtenemos el acceso al directorio raíz de OPFS
        const root = await navigator.storage.getDirectory();
        
        // Creamos (o pisamos) el archivo en el origen
        const fileHandle = await root.getFileHandle(filename, { create: true });
        
        // Creamos un stream de escritura
        const writable = await fileHandle.createWritable();
        
        // Escribimos el blob/buffer
        await writable.write(content);
        
        // Cerramos el stream para salvar en dico duro
        await writable.close();
        
        console.log(`[OPFS] Archivo guardado con éxito: ${filename}`);
        return filename; 
    } catch (error) {
        console.error(`[OPFS] Error guardando archivo ${filename}:`, error);
        throw error;
    }
}

/**
 * Recupera un archivo desde OPFS en formato `File` para ser consumido
 * vía URL.createObjectURL() (por ejemplo, para inyectar en <video>).
 * @param {string} filename - Nombre del archivo a buscar
 * @returns {Promise<File | null>} El objeto de archivo, o null si falla.
 */
export async function getFileFromOPFS(filename) {
    try {
        const root = await navigator.storage.getDirectory();
        
        // Accedemos al handle
        const fileHandle = await root.getFileHandle(filename, { create: false });
        
        // Obtenemos el objeto base `File`
        const file = await fileHandle.getFile();
        
        console.log(`[OPFS] Archivo recuperado: ${filename} (${file.size} bytes)`);
        return file;
    } catch (error) {
        if (error.name === 'NotFoundError') {
             console.warn(`[OPFS] Archivo no encontrado: ${filename}`);
             return null;
        }
        console.error(`[OPFS] Error leyendo archivo ${filename}:`, error);
        throw error;
    }
}

/**
 * Borra un archivo del OPFS.
 * @param {string} filename 
 */
export async function deleteFileFromOPFS(filename) {
    try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(filename);
        console.log(`[OPFS] Archivo eliminado: ${filename}`);
    } catch (error) {
        if (error.name !== 'NotFoundError') {
            console.error(`[OPFS] Error eliminando archivo ${filename}:`, error);
        }
    }
}
