
import fetch from 'node-fetch';

async function login() {
    try {
        const response = await fetch('http://localhost:3002/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: '2002wilmarb14@gmail.com',
                password: 'wrongpassword' // Expected 400 if working, 500 if broken
            })
        });

        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log('Response:', data);
    } catch (err) {
        console.error('Error connecting to server:', err.message);
    }
}

login();
