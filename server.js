const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "MonSuperSecret123"; 
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

// Création du serveur HTTP requis pour les WebSockets
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware de sécurité (HTTP)
function checkAuth(req, res, next) {
    const clientSecret = req.headers['api-secret'] || req.headers['x-nightscout-token'];
    if (!clientSecret || clientSecret !== EXPECTED_HASH) {
        return res.status(401).json({ error: "Non autorisé" });
    }
    next();
}

app.get('/', (req, res) => {
    res.send("<h1>Serveur compatible AndroidAPS 3.4 actif !</h1>");
});

// Gestion de la connexion WebSocket d'AndroidAPS v3.4
io.on('connection', (socket) => {
    console.log(`[WebSocket] Un appareil tente de se connecter (${socket.id})`);

    // Gestion de la phase d'authentification exigée par AAPS
    socket.on('authorize', (data) => {
        // AAPS v3.4 envoie souvent le hash ou le secret pour valider la connexion
        console.log("[WebSocket] Demande d'autorisation reçue :", data);
        socket.emit('authorized', { status: 'granted' });
    });

    socket.on('disconnect', () => {
        console.log(`[WebSocket] Appareil déconnecté (${socket.id})`);
    });
});

// Endpoints HTTP classiques (au cas où)
app.post('/api/v1/entries', checkAuth, (req, res) => {
    console.log(`\n[HTTP] Glycémie reçue :`, req.body);
    res.status(200).json({ status: "success", count: req.body.length });
});

app.post('/api/v1/treatments', checkAuth, (req, res) => {
    console.log(`\n[HTTP] Traitement reçu :`, req.body);
    res.status(200).json({ status: "success" });
});

server.listen(PORT, () => {
    console.log(`Serveur hybride (HTTP + WebSocket) en ligne sur le port ${PORT}`);
});


