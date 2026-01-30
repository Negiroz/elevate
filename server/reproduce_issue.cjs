const http = require('http');
const jwt = require('jsonwebtoken'); // Need to install or use from server/node_modules
const { v4: uuidv4 } = require('uuid');

const SECRET = 'dev-secret-key-change-in-prod';

// Mock user token
const token = jwt.sign({ id: 'admin-id', email: 'admin@elevate.com', role: 'Administrador' }, SECRET, { expiresIn: '1h' });

const runTest = async () => {
    // 1. Test success with null email
    await postProfile({ ...basePayload, email: null, first_name: "NullEmail" });

    // 2. Test success with empty string email (Now should work, as it converts to NULL)
    await postProfile({ ...basePayload, email: "", first_name: "EmptyStringEmail" });
    await postProfile({ ...basePayload, email: "", first_name: "EmptyStringShouldWorkNow" });
};

const basePayload = {
    first_name: "Test",
    last_name: "Member",
    role: "Miembro",
    active: true,
    birth_date: "1990-01-01"
};

function postProfile(payload) {
    return new Promise((resolve) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: '/api/profiles',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Authorization': `Bearer ${token}`
            }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                console.log(`[${payload.first_name}] STATUS: ${res.statusCode} BODY: ${body}`);
                resolve();
            });
        });
        req.write(data);
        req.end();
    });
}

runTest();
