const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "1234567890123"; 

// Calcul du hash SHA-1 requis pour l'authentification V1
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Structure de réponse réutilisable pour satisfaire AndroidAPS
const statusResponse = {
    status: "ok",
    version: "15.0.2", 
    name: "nightscout",
    description: "Maison Server",
    authorized: true,
    settings: {
        units: "mg/dl",
        timeFormat: 24,
        nightMode: true,
        authDefaultRoles: "readable"
    }
};

// Émulation de l'ensemble des routes d'état de Nightscout
app.get('/api/v1/status.json', (req, res) => res.json(statusResponse));
app.get('/api/v1/status', (req, res) => res.json(statusResponse));
app.get('/api/v1/experiments', (req, res) => res.json([]));
app.get('/api/v1/experiments.json', (req, res) => res.json([]));

app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1.5 (Strict) Actif !</h1>");
});

// Protocole WebSocket de communication Nightscout V1
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    socket.on('authorize', (authData) => {
        console.log("[WS V1] Requête d'autorisation reçue :", authData);
        
        const clientSecretHash = authData.secret;

        if (clientSecretHash === EXPECTED_HASH || authData.token) {
            console.log("[WS V1] Authentification réussie !");
            
            // Émission des droits requis par NSClientV1 pour lever le blocage
            socket.emit('authorized', { status: 'granted' });
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            
            // Initialisation de la file d'attente
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec de l'authentification (Secret non valide). Disconnexion.");
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




