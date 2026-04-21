const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { uploadData } = require('./storage');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Permitir que la extensión React se conecte
});

app.use(cors());
app.use(express.json());

// Proxy Bridge Handoff
let activeMoodleClient = null;

io.on('connection', (socket) => {
    console.log(`[Handoff Socket] Extensión Moodle unida con ID: ${socket.id}`);
    activeMoodleClient = socket;
    
    socket.on('disconnect', () => {
        if (activeMoodleClient?.id === socket.id) {
            activeMoodleClient = null;
            console.log(`[Handoff Socket] Extensión Moodle se desconectó.`);
        }
    });
});

// Helper para emitir peticiones síncronas al socket de Chrome Extension
function requestMoodleDataFromClient(action, payload = {}) {
    return new Promise((resolve, reject) => {
        if (!activeMoodleClient) {
            return reject(new Error('La extensión Moodle no está conectada al Handoff Proxy. Asegúrese de abrir el frontend.'));
        }
        
        const timeout = setTimeout(() => {
            reject(new Error('Timeout esperando a la base de datos PGlite del Cliente'));
        }, 8000); // 8 secs max await

        try {
            activeMoodleClient.emit('REQUEST_MOODLE_DATA', { action, ...payload }, (response) => {
                clearTimeout(timeout);
                if (response?.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response?.data || []);
                }
            });
        } catch (e) {
            clearTimeout(timeout);
            reject(e);
        }
    });
}


const PORT = process.env.PORT || 3000;

// Configuración de Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pion/Handoff REST API',
      version: '1.0.0',
      description: 'API para interactuar con sesiones Handoff WebRTC, PGlite y S3 (RustFS)',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: ['./server.js'], // Identifica este archivo para leer los metadatos YAML de Swagger
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Handoff state endpoints were removed based on user request (not used in OPFS architecture)

/**
 * @swagger
 * /api/recordings:
 *   post:
 *     summary: Sube una nueva grabación interceptada a S3 (RustFS)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               base64Data:
 *                 type: string
 *     responses:
 *       200:
 *         description: Grabación subida a S3 existosamente.
 */
app.post('/api/recordings', async (req, res) => {
    try {
        const { fileName, base64Data } = req.body; 
        if(!fileName) return res.status(400).json({ error: "fileName required" });

        const buffer = Buffer.from(base64Data || 'mock data', 'base64');
        const bucketUrl = await uploadData('recordings', fileName, buffer);
        res.json({ success: true, url: bucketUrl });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/moodle/courses:
 *   get:
 *     summary: Extrae la lista de cursos oxigenados (Consultado a la Extensión via Proxy WebRTC/Socket)
 *     responses:
 *       200:
 *         description: Lista de cursos disponibles.
 */
app.get('/api/moodle/courses', async (req, res) => {
    try {
        const data = await requestMoodleDataFromClient('courses');
        res.json(data);
    } catch(e) {
        res.status(502).json({ error: e.message }); // 502 Bad Gateway
    }
});

/**
 * @swagger
 * /api/moodle/course/{id}:
 *   get:
 *     summary: Extrae detalles de un curso y sus recursos categorizados (books, foros, quizzes, zoom)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalles del curso y sus recursos
 */
app.get('/api/moodle/course/:id', async (req, res) => {
    try {
        const result = await requestMoodleDataFromClient('course_details', { id: req.params.id });
        res.json(result);
    } catch (error) {
        console.error(`Error fetching course ${req.params.id} from client:`, error);
        res.status(502).json({ error: 'Bad Gateway - Error extrayendo recursos del cliente', details: error.message });
    }
});

/**
 * @swagger
 * /api/moodle/resources:
 *   get:
 *     summary: Obtiene todos los recursos, opcionalmente filtrados por tipo (Consultado a la Extensión)
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtra por tipo de recurso (video, book)
 *     responses:
 *       200:
 *         description: Inventario de recursos de Moodle
 */
app.get('/api/moodle/resources', async (req, res) => {
    try {
        const { tipo } = req.query;
        const data = await requestMoodleDataFromClient('resources', { tipo });
        res.json(data);
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

/**
 * @swagger
 * /api/moodle/books/{id}/chapters:
 *   get:
 *     summary: Obtiene los capitulos fragmentados (Consultado a la Extensión)
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Capitulos extraidos.
 */
app.get('/api/moodle/books/:id/chapters', async (req, res) => {
    try {
        const data = await requestMoodleDataFromClient('book_chapters', { id: req.params.id });
        res.json(data);
    } catch(e) {
        res.status(502).json({ error: e.message});
    }
});

server.listen(PORT, () => {
  console.log(`🚀 Pion/Handoff REST API iniciada en http://localhost:${PORT}`);
  console.log(`📘 Documentación Swagger disponible en http://localhost:${PORT}/api-docs`);
  console.log(`🧠 Para levantar el MCP independiente, ejecuta: npm run mcp (o usa STDIO en clientes MCP localmente)`);
});
