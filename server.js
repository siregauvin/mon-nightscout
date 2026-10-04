const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Clé de sécurité (Définie directement sur Internet plus tard pour plus de sécurité)
const API_SECRET = process.env.API_SECRET || "1234567890123"; 
const EXPECTED_HASH = crypto.createHash('sha1').update(API_SECRET).digest('hex');

function checkAuth(req, res, next) {
    const clientSecret = req.headers['api-secret'] || req.headers['x-nightscout-token'];
    if (!clientSecret || clientSecret !== EXPECTED_HASH) {
        return res.status(401).json({ error: "Non autorisé" });
    }
    next();
}

app.get('/', (req, res) => {
    res.send("<h1>Votre serveur Nightscout maison est en ligne !</h1>");
});

app.post('/api/v1/entries', checkAuth, (req, res) => {
    console.log(`\n[${new Date().toLocaleTimeString()}] Glycémie reçue :`, req.body);
    res.status(200).json({ status: "success", count: req.body.length });
});

app.post('/api/v1/treatments', checkAuth, (req, res) => {
    console.log(`\n[${new Date().toLocaleTimeString()}] Traitement reçu :`, req.body);
    res.status(200).json({ status: "success" });
});

// En ligne, le port est attribué dynamiquement par l'hébergeur
const PORT = process.env.PORT || 1337;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

