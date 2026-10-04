const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 1337;
const API_SECRET = process.env.API_SECRET || "1234567890123"; 

// Calcul du hash SHA-1 pour l'authentification WebSocket d'AAPS V1
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Route d'accueil
app.get('/', (req, res) => {
    res.send("<h1>Serveur Émulation Nightscout V1 Actif !</h1>");
});

// Émulation du protocole WebSocket Nightscout V1 pour AndroidAPS
io.on('connection', (socket) => {
    console.log(`[WS V1] Appareil connecté (${socket.id})`);

    // AndroidAPS V1 envoie l'événement 'authorize' avec le hash SHA-1 du secret
    socket.on('authorize', (authData) => {
        console.log("[WS V1] Données d'autorisation reçues :", authData);
        
        const clientSecretHash = authData.secret;

        if (clientSecretHash === EXPECTED_HASH) {
            console.log("[WS V1] Authentification réussie !");
            
            // Étape CRUCIALE pour AAPS V1 : Renvoyer l'autorisation et les droits d'accès
            socket.emit('authorized', { status: 'granted' });
            
            // Accusé de réception indispensable pour valider la connexion dans l'application
            socket.emit('connected', { read: true, write: true, write_treatment: true });
            
            // Envoyer un statut de mise à jour vide pour valider la boucle d'initialisation
            socket.emit('dataUpdate', { entries: [], treatments: [], devicestatus: [] });
        } else {
            console.log("[WS V1] Échec de l'authentification (Secret incorrect). Disconnexion.");
            socket.disconnect();
        }
    });

    // Réception des données de glycémie et traitements via WebSocket v1
    socket.on('dbAdd', (payload) => {
        console.log(`\n[WS V1] Données reçues via collection : ${payload.collection}`);
        console.log(payload.data);
        
        // Répondre avec un identifiant fictif pour acquitter la bonne réception des données
        socket.emit('dbAdd_ack', [{ _id: crypto.randomBytes(12).toString('hex') }]);
    });

    socket.on('disconnect', () => {
        console.log(`[WS V1] Appareil déconnecté (${socket.id})`);
    });
});

server.listen(PORT, () => {
    console.log(`Serveur Nightscout V1 hybride en ligne sur le port ${PORT}`);
});


