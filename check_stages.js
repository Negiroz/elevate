
// Native fetch used


const API_URL = 'http://localhost:3002/api';

async function check() {
    console.log("1. Logging in...");
    try {
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@elevate.com', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error("Login failed:", await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.session?.access_token;
        console.log("Login successful. Token obtained.");

        console.log("2. Fetching Stages...");
        const stagesRes = await fetch(`${API_URL}/consolidation_stages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!stagesRes.ok) {
            console.error("Fetch stages failed:", await stagesRes.text());
            return;
        }

        const stages = await stagesRes.json();
        console.log("Stages fetched successfully:");
        console.log(JSON.stringify(stages, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

check();
