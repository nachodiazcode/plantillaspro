import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import { connectDB } from './config/connectDB.js';
import routes from './routes/index.js';
import errorHandler from './middlewares/errorHandler.js';
import logger from './utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
dotenv.config();
 
// Conectar a la base de datos
connectDB();

// Define __dirname in terms of ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Inicializar Express
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
    cors: {
        origin: "*"
    }
});

// Configuración de Swagger para documentación de API
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'API White',
            version: '1.0.0',
            description: 'Documentación de la API White'
        },
        servers: [
            {
                url: 'http://localhost:3990'
            }
        ]
    },
    apis: ['./routes/*.js'] // path to the API docs
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware de seguridad, parseo de cookies, CORS y logs
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Middleware para permitir el uso de `io` en rutas
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Rate Limiting para prevenir ataques de fuerza bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Demasiadas solicitudes desde esta IP, por favor inténtalo de nuevo después de un rato.'
});
app.use(limiter);

// Rutas
app.use('/api', routes);

// Manejo de errores
app.use(errorHandler);

// Servidor estático para imágenes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.send('API de apiwhite funcionando correctamente.');
});

// Manejo de eventos de Socket.io
io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado', socket.id);
    });
});

// Iniciar servidor
httpServer.listen(process.env.PORT || 3990, () => {
    logger.info(`Servidor corriendo en el puerto ${process.env.PORT || 3990}`);
});
