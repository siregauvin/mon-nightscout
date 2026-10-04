const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "1234567890123"; 

// Calcul du hash SHA-1 pour l'authentification WebSocket
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// 1. ROUTE CRUCIALE : Renvoyer une version officielle de Nightscout à AndroidAPS
app.get('/api/v1/status.json', (req, res) => {
    res.json({
        status: "ok",
        version: "15.0.2", // Une version moderne et acceptée par AAPS 3.4
        name: "nightscout",
        description: "Maison Server",
        settings: {
            units: "mg/dl",
            timeFormat: 24,
            nightMode: true,
            authDefaultRoles: "readable"
        }
    });
});

app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1.5 Actif !</h1>");
});

// Émulation du protocole WebSocket Nightscout V1
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    socket.on('authorize', (authData) => {
        console.log("[WS V1] Données d'autorisation reçues :", authData);
        
        const clientSecretHash = authData.secret;

        if (clientSecretHash === EXPECTED_HASH) {
            console.log("[WS V1] Authentification réussie !");
            
            // Validation et envoi des droits requis par NSClientV1
            socket.emit('authorized', { status: 'granted' });
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            
            // Notification immédiate pour débloquer la file d'attente d'AndroidAPS
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec de l'authentification. Déconnexion.");
            socket.disconnect();
        }
    });

    socket.on('dbAdd', (payload) => {
        console.log(`\n[WS V1] Données reçues dans la collection : ${payload.collection}`);
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



