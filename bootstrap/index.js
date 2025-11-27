// const fs = require('fs');
// const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const PORT = 4000;
// const MALICIOUS_FILE = path.join(__dirname, 'maliciousData.json');

let peers = [];
let heartbeats = new Map();
// let maliciousData = loadMaliciousData();

// function loadMaliciousData() {
//     try {
//         if (fs.existsSync(MALICIOUS_FILE)) {
//             return JSON.parse(fs.readFileSync(MALICIOUS_FILE, 'utf8'));
//         }
//         return { counts: {}, blacklisted: [] };
//     } catch (error) {
//         console.error("❌ Failed to load malicious data:", error);
//         return { counts: {}, blacklisted: [] };
//     }
// }

// function saveMaliciousData(data) {
//     try {
//         fs.writeFileSync(MALICIOUS_FILE, JSON.stringify(data, null, 2));
//         console.log("💾 Malicious data saved successfully.");
//     } catch (error) {
//         console.error("❌ Failed to save malicious data:", error);
//     }
// }

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

// app.get('/malicious', (req, res) => {
//     res.json(maliciousData);
// });

// app.post('/malicious', (req, res) => {


app.post('/heartbeat', (req, res) => {
    const {address} = req.body;
    const now = Date.now();

    if (address) {
        heartbeats[address] = now;
        if(!peers.includes(address))
            peers.push(address);
        console.log(`Heartbeat from ${address} at ${Date.now()}`);
    }
    res.json({status: 'ok'});
})

app.listen(PORT,'0.0.0.0' ,() => {
    console.log(`Bootstrap server running on port ${PORT}`);
});