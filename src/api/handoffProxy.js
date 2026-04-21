import { io } from 'socket.io-client';
import { getPgliteInstance } from '../db/pgliteSync';
import { dbService } from '../db/service';
import { Q } from '@nozbe/watermelondb';

const PROXY_URL = 'http://localhost:3000';
let socket = null;

let progressCallback = null;

export const setJobProgressCallback = (cb) => {
    progressCallback = cb;
};

export const enqueueMediaSync = (payload) => {
    if (socket) {
        socket.emit("SYNC_DATA", payload);
    } else {
        console.warn("[Handoff] Socket no listo para encolar");
    }
};

export const initHandoffProxy = () => {
    if (socket) return;
    
    console.log('[Handoff Proxy] Inicializando conexión WebSocket con la API...', PROXY_URL);
    socket = io(PROXY_URL, { reconnection: true });

    socket.on('connect', () => {
        console.log('[Handoff Proxy] ✅ Conectado exitosamente y listo para interceptar queries Moodle al Desktop.');
    });

    socket.on('JOB_PROGRESS', (data) => {
        console.log('[Handoff Tracker]', data);
        if(progressCallback) progressCallback(data);
    });

    socket.on('REQUEST_MOODLE_DATA', async (payload, callback) => {
        console.log('[Handoff Proxy] 📥 Petición de Moodle recibida desde la PC:', payload);
        try {
            // Los cursos y sus jerarquias se persisten indexadamente en WatermelonDB
            if (payload.action === 'courses') {
                const courses = await dbService.getCoursesCollection().query().fetch();
                const rawCourses = courses.map(c => c._raw);
                console.log(`[Handoff Proxy] 📤 Respondiendo con ${rawCourses.length} cursos desde WatermelonDB.`);
                return callback({ success: true, data: rawCourses });
            }

            if (payload.action === 'course_details') {
                const coursesCollection = dbService.getCoursesCollection();
                const courseArr = await coursesCollection.query(Q.where('id', payload.id)).fetch();
                const course = courseArr.length > 0 ? courseArr[0]._raw : null;

                if (!course) return callback({ error: `Curso ${payload.id} no encontrado en la caché local de Moodle` });

                const resourcesCollection = coursesCollection.database.collections.get('resources');
                const resourcesArr = await resourcesCollection.query(Q.where('course_id', payload.id)).fetch();
                const rawResources = resourcesArr.map(r => r._raw);

                const dataGrouped = {
                    course: course,
                    books: rawResources.filter(r => r.type === 'book'),
                    foros: rawResources.filter(r => r.type === 'forum'),
                    quizzes: rawResources.filter(r => r.type === 'quiz'),
                    zoom: rawResources.filter(r => r.type === 'zoomutnba'),
                    others: rawResources.filter(r => !['book','forum','quiz','zoomutnba'].includes(r.type))
                };
                
                console.log(`[Handoff Proxy] 📤 Respondiendo detalles de curso ${payload.id} (${rawResources.length} recursos agrupados).`);
                return callback({ success: true, data: dataGrouped });
            }

            // Los binarios e indices (videos/capitulos) residen en PGlite OPFS
            const db = await getPgliteInstance();
            let query = '';
            let params = [];

            if (payload.action === 'resources') {
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
            console.log(`[Handoff Proxy] 📤 Respondiendo con ${results.rows.length} filas desde PGlite.`);
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
