const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "1234567890123"; 

// Calcul du hash SHA-1 requis par NSClientV1
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

// Middleware pour ajouter les en-têtes Nightscout obligatoires à TOUTES les réponses
app.use((req, res, next) => {
    res.setHeader('X-Nightscout-Version', '15.0.2');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Structure complète attendue par le validateur de version d'AAPS
const statusResponse = {
    status: "ok",
    version: "15.0.2", 
    name: "nightscout",
    description: "Maison Server",
    authorized: true,
    serverTime: new Date().toISOString(),
    apiEnabled: true,
    settings: {
        units: "mg/dl",
        timeFormat: 24,
        nightMode: true,
        authDefaultRoles: "readable",
        customTitle: "Nightscout Maison"
    },
    extended: {
        version: "15.0.2",
        name: "nightscout"
    }
};

// Émulation de toutes les routes de vérification de version et de sécurité
app.get('/api/v1/status.json', (req, res) => res.json(statusResponse));
app.get('/api/v1/status', (req, res) => res.json(statusResponse));
app.get('/api/v1/experiments', (req, res) => res.json([]));
app.get('/api/v1/experiments.json', (req, res) => res.json([]));
app.get('/api/v1/profile', (req, res) => res.json([{}]));
app.get('/api/v1/profile.json', (req, res) => res.json([{}]));

// Route d'autorisation par jeton parfois appelée par AAPS avant le WebSocket
app.get('/api/v1/authorization', (req, res) => {
    res.json({ status: "authorized", token: "fictif-token", permissions: ["read", "write"] });
});

app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1.5 (Strict) Actif !</h1>");
});

// Échange WebSocket V1
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    socket.on('authorize', (authData) => {
        console.log("[WS V1] Requête d'autorisation reçue :", authData);
        
        const clientSecretHash = authData.secret;

        // Validation par clé ou par jeton d'accès
        if (clientSecretHash === EXPECTED_HASH || authData.token) {
            console.log("[WS V1] Authentification réussie !");
            
            // Émission immédiate des acquittements attendus par NSClientV1
            socket.emit('authorized', { status: 'granted' });
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            
            // Forcer l'envoi d'un paquet initial pour débloquer l'état "Connecting..."
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec de l'authentification. Fin de session.");
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
    console.log(`Serveur Nightscout V1 hybride en ligne sur le port ${PORT}`);
});





