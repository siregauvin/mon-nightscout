const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "1234567890123"; 
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

// Configuration globale des en-têtes HTTP Nightscout
app.use((req, res, next) => {
    res.setHeader('X-Nightscout-Version', '15.0.2');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

const server = http.createServer(app);

// =========================================================================
// ÉTAPE CRUCIALE : Forcer la compatibilité avec le vieux protocole Socket.io d'AAPS
// allowEIO3: true permet d'accepter le moteur Engine.IO v3 (utilisé par Socket.io v2)
// =========================================================================
const io = new Server(server, {
    allowEIO3: true, 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    }
});

const statusResponse = {
    status: "ok",
    version: "15.0.2", 
    name: "nightscout",
    authorized: true,
    settings: {
        units: "mg/dl",
        timeFormat: 24,
        nightMode: true,
        authDefaultRoles: "readable"
    }
};

// Endpoints API REST de secours
app.get('/api/v1/status.json', (req, res) => res.json(statusResponse));
app.get('/api/v1/status', (req, res) => res.json(statusResponse));
app.get('/api/v1/experiments', (req, res) => res.json([]));
app.get('/api/v1/profile', (req, res) => res.json([{}]));

app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1.5 (Strict) Actif !</h1>");
});

// Échange WebSocket V1
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    // Envoi immédiat de la version dès la poignée de main réseau réussie
    socket.emit('info', {
        version: "15.0.2",
        serverTime: new Date().toISOString(),
        name: "nightscout"
    });

    socket.on('authorize', (authData) => {
        console.log("[WS V1] Requête d'autorisation reçue :", authData);
        
        const clientSecretHash = authData.secret;

        if (clientSecretHash === EXPECTED_HASH || authData.token) {
            console.log("[WS V1] Authentification REUSSIE !");
            
            socket.emit('authorized', { status: 'granted' });
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec d'authentification.");
            socket.disconnect();
        }
    });

    socket.on('dbAdd', (payload) => {
        console.log(`\n[WS V1] Données reçues dans [${payload.collection}]`);
        console.log(payload.data);
        socket.emit('dbAdd_ack', [{ _id: crypto.randomBytes(12).toString('hex') }]);
    });

    socket.on('disconnect', () => {
        console.log(`[WS V1] Appareil déconnecté (${socket.id})`);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur Nightscout V1 compatible v2/v4 en ligne sur le port ${PORT}`);
});





