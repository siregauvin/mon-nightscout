const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "1234567890123"; 
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

// Configuration stricte des en-têtes HTTP requis par AndroidAPS 3.4
app.use((req, res, next) => {
    res.setHeader('X-Nightscout-Version', '15.0.0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

const server = http.createServer(app);

// Forcer la compatibilité descendante avec le moteur Engine.IO v3 (Socket.io v2 d'AAPS)
const io = new Server(server, {
    allowEIO3: true, 
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Structure de réponse complète et certifiée compatible avec le validateur d'AAPS 3.4
const fullStatusResponse = {
    status: "ok",
    version: "15.0.0",
    name: "nightscout",
    description: "Nightscout Maison",
    authorized: true,
    serverTime: new Date().toISOString(),
    apiEnabled: true,
    settings: {
        units: "mg/dl",
        timeFormat: 24,
        nightMode: true,
        authDefaultRoles: "readable",
        customTitle: "Nightscout",
        alarmUrgentHigh: true,
        alarmHigh: true,
        alarmLow: true,
        alarmUrgentLow: true
    },
    extended: {
        version: "15.0.0",
        name: "nightscout"
    }
};

// Endpoints d'état HTTP
app.get('/api/v1/status.json', (req, res) => res.json(fullStatusResponse));
app.get('/api/v1/status', (req, res) => res.json(fullStatusResponse));
app.get('/api/v1/experiments', (req, res) => res.json([]));
app.get('/api/v1/profile', (req, res) => res.json([{}]));

app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1.5 (Strict) Actif !</h1>");
});

// Gestion du protocole WebSocket
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    // =========================================================================
    // ENVOI DE L'ÉVÉNEMENT INFO : La structure doit être calquée sur le statut HTTP
    // =========================================================================
    socket.emit('info', {
        version: "15.0.0",
        serverTime: new Date().toISOString(),
        name: "nightscout",
        settings: fullStatusResponse.settings
    });

    socket.on('authorize', (authData) => {
        console.log("[WS V1] Requête d'autorisation reçue :", authData);
        
        const clientSecretHash = authData.secret;

        if (clientSecretHash === EXPECTED_HASH || authData.token) {
            console.log("[WS V1] Authentification REUSSIE !");
            
            socket.emit('authorized', { status: 'granted' });
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            
            // On renvoie un jeu d'initialisation propre pour acquitter la connexion
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec de l'authentification (Secret non valide).");
            socket.disconnect();
        }
    });

    socket.on('dbAdd', (payload) => {
        console.log(`\n[WS V1] Données reçues [${payload.collection}]`);
        console.log(payload.data);
        socket.emit('dbAdd_ack', [{ _id: crypto.randomBytes(12).toString('hex') }]);
    });

    socket.on('disconnect', () => {
        console.log(`[WS V1] Appareil déconnecté (${socket.id})`);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur d'ingestion hybride démarré sur le port ${PORT}`);
});






