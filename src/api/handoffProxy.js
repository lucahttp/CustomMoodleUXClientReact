import { io } from 'socket.io-client';
import { getPgliteInstance } from '../db/pgliteSync';

const PROXY_URL = 'http://localhost:3000';
let socket = null;

export const initHandoffProxy = () => {
    if (socket) return;
    
    console.log('[Handoff Proxy] Inicializando conexión WebSocket con la API...', PROXY_URL);
    socket = io(PROXY_URL, { reconnection: true });

    socket.on('connect', () => {
        console.log('[Handoff Proxy] ✅ Conectado exitosamente y listo para interceptar queries Moodle al Desktop.');
    });

    socket.on('REQUEST_MOODLE_DATA', async (payload, callback) => {
        console.log('[Handoff Proxy] 📥 Petición de Moodle recibida desde la PC:', payload);
        try {
            const db = await getPgliteInstance();
            let query = '';
            let params = [];

            if (payload.action === 'courses') {
                query = 'SELECT * FROM cursos';
            } else if (payload.action === 'resources') {
                query = 'SELECT * FROM recursos';
                if (payload.tipo) {
                    query += ' WHERE tipo = $1';
                    params.push(payload.tipo);
                }
            } else if (payload.action === 'book_chapters') {
                query = 'SELECT * FROM capitulos_libros WHERE libro_id = $1';
                params.push(payload.id);
            }

            if (!query) {
               return callback({ error: 'Acción no soportada por el Proxy de Handoff' });
            }

            const results = await db.query(query, params);
            console.log(`[Handoff Proxy] 📤 Respondiendo con ${results.rows.length} filas.`);
            callback({ success: true, data: results.rows });

        } catch (e) {
            console.error('[Handoff Proxy] Error resolviendo petición:', e);
            callback({ error: e.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('[Handoff Proxy] ❌ Desconectado de la API Local. Se pausará la sincronización Handoff.');
    });
};
