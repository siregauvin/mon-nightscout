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

// Configuration globale des en-têtes HTTP Nightscout
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

// Endpoints API REST
app.get('/api/v1/status.json', (req, res) => res.json(statusResponse));
app.get('/api/v1/status', (req, res) => res.json(statusResponse));
app.get('/api/v1/experiments', (req, res) => res.json([]));
app.get('/api/v1/profile', (req, res) => res.json([{}]));

app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1.5 Strictement Actif !</h1>");
});

// Gestion stricte du protocole WebSocket Nightscout V1
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    // =========================================================================
    // ÉTAPE CRITIQUE : Envoyer l'événement 'info' immédiatement après la connexion.
    // C'est ce message que NSClientV1 cherche pour valider la version de l'API !
    // =========================================================================
    socket.emit('info', {
        version: "15.0.2",
        serverTime: new Date().toISOString(),
        name: "nightscout"
    });

    // Événement d'authentification initié par AndroidAPS
    socket.on('authorize', (authData) => {
        console.log("[WS V1] Requête d'autorisation reçue :", authData);
        
        const clientSecretHash = authData.secret;

        if (clientSecretHash === EXPECTED_HASH || authData.token) {
            console.log("[WS V1] Authentification REUSSIE !");
            
            // Acquittements obligatoires exigés par le module V1 d'AndroidAPS
            socket.emit('authorized', { status: 'granted' });
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            
            // Vider temporairement le delta initial pour débloquer l'état de l'application
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec de l'authentification (Secret invalide).");
            socket.disconnect();
        }
    });

    // Réception des glycémies en direct
    socket.on('dbAdd', (payload) => {
        console.log(`\n[WS V1] Données interceptées dans la collection : ${payload.collection}`);
        console.log(payload.data);
        
        // Notification d'enregistrement réussi (ACK) pour effacer la file d'attente d'AAPS
        socket.emit('dbAdd_ack', [{ _id: crypto.randomBytes(12).toString('hex') }]);
    });

    socket.on('disconnect', () => {
        console.log(`[WS V1] Appareil déconnecté (${socket.id})`);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur Nightscout V1 en ligne sur le port ${PORT}`);
});





