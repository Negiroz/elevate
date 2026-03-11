
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002/api';

async function test() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@elevate.com', password: 'admin123' })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
        }

        const loginData = await loginRes.json();
        const token = loginData.session.access_token;
        console.log('Login successful. Token acquired.');

        // 2. Fetch Districts
        console.log('Fetching districts...');
        const districtsRes = await fetch(`${API_URL}/districts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!districtsRes.ok) {
            throw new Error(`Districts fetch failed: ${districtsRes.status}`);
        }

        const districts = await districtsRes.json();
        console.log(`Fetched ${districts.length} districts.`);

        if (districts.length > 0) {
            // Find one with a known supervisor if possible, or just dump the first one
            const sample = districts.find(d => d.name === 'Amarillo') || districts[0];
            console.log('Sample District JSON:', JSON.stringify(sample, null, 2));

            if (sample.supervisor_first_name) {
                console.log('SUCCESS: supervisor_first_name is present.');
            } else {
                console.log('FAILURE: supervisor_first_name is MISSING.');
            }
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
