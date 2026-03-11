
import fetch from 'node-fetch';

async function login(idx, payload) {
    try {
        console.log(`Test ${idx}: Payload:`, payload);
        const response = await fetch('http://localhost:3002/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Test ${idx} Status: ${response.status}`);
        const data = await response.json();
        console.log(`Test ${idx} Response:`, data);
    } catch (err) {
        console.error(`Test ${idx} Error connecting to server:`, err.message);
    }
}

async function run() {
    await login(1, { email: '2002wilmarb14@gmail.com', password: 'wrongpassword' }); // Should be 400
    await login(2, { password: 'somepassword' }); // Missing email - Should verify handling
    await login(3, { email: null, password: 'somepassword' }); // Null email
}

run();
