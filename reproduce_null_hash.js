
import fetch from 'node-fetch';

async function run() {
    try {
        const payload = { email: 'ramirogonzgg@hotmail.com', password: 'any' }; // This user has null hash
        console.log(`Testing with payload:`, payload);
        const response = await fetch('http://localhost:3002/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Response:`, data);
    } catch (err) {
        console.error(`Error connecting to server:`, err.message);
    }
}

run();
