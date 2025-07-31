const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const PORT = 4000;
let peers = [];

app.use(bodyParser.json());

app.post('/register', (req, res) => {
    const { address } = req.body;
    if (address && !peers.includes(address)) {
        peers.push(address);
        console.log(`Registered peer: ${address}`);
    }
    res.json({ status: 'ok' });
});

app.get('/peers', (req, res) => {
    console.log(`Fetching registered peers ${peers}`);
    res.json(peers);
});

app.listen(PORT,'0.0.0.0' ,() => {
    console.log(`Bootstrap server running on port ${PORT}`);
});