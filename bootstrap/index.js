const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const PORT = 4000;

let peers = [];
let heartbeats = new Map();

app.use(bodyParser.json());

app.post('/register', (req, res) => {
    const { address } = req.body;
    if (address && !peers.includes(address)) {
        peers.push(address);
        console.log(`Registered peer: ${address}`);
    }
    res.json({ status: 'ok' });
});

app.post('/unregister', (req, res) => {
    const { address } = req.body;
    if (address && peers.includes(address)) {
        peers = peers.filter(peer => peer !== address);
        console.log(`Unregistered peer: ${address}`);
    }
    res.json({ status: 'ok' });
})

app.get('/peers', (req, res) => {
    console.log(`Fetching registered peers ${peers}`);
    res.json(peers);
});

app.post('/heartbeat', (req, res) => {
    const {address} = req.body;
    const now = Date.now();

    if (address) {
        heartbeats[address] = now;
        if(!peers.includes(address))
            peers.push(address);
        console.log(`Heartbeat from ${address} at ${new Date(now).toISOString()}`);
    }
    res.json({status: 'ok'});
})

app.listen(PORT,'0.0.0.0' ,() => {
    console.log(`Bootstrap server running on port ${PORT}`);
});