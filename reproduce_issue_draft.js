const http = require('http');

const data = JSON.stringify({
    first_name: "Test",
    last_name: "User",
    email: null,
    role: "Miembro",
    active: true,
    // Add other fields if necessary to match UserContext payload
    district_id: null,
    cell_id: null
});

const options = {
    hostname: 'localhost',
    port: 3002, // Hit backend directly to see raw error if possible, or 3001 via proxy
    path: '/api/profiles',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        // We need an auth token. I will try to login first or mock it.
        // Since I don't have a token easily, I might need to login first.
    }
};

// Wait, I need a token. Let's try to login as admin first in the script.
// Assuming a default admin exists or I can create one.
// Actually, I can check if there's a dev token or just use the login endpoint.

async function run() {
    // 1. Login
    const loginData = JSON.stringify({
        email: 'pastor@elevate.com', // Assuming this exists from seed, or I'll check database content
        password: 'admin' // Guessing common password or I need to check
    });
    // If I don't know the password, I might need to bypass auth or check the DB.
}
// BETTER APPROACH:
// I will just modify server/routes.js temporarily to log the detailed error to console
// OR I will read the server output which I already have access to.
