import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3002';

async function verify() {
    // 0. Register a temp admin to ensure we have credentials
    const timestamp = Date.now();
    const email = `admin_${timestamp}@test.com`;
    const password = 'password123';

    console.log(`0. Registering temp admin: ${email}`);
    const signupRes = await fetch(`${BASE_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            password,
            data: {
                first_name: 'Test',
                last_name: 'Admin',
                role: 'Administrador'
            }
        })
    });

    if (!signupRes.ok) {
        console.error('Signup failed:', await signupRes.text());
        // If signup failed, maybe DB issue or validation. Continue to try login if it was "exists" error
    } else {
        console.log('Signup successful.');
    }

    console.log('1. Logging in...');
    const loginRes = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!loginRes.ok) {
        console.error('Login failed:', await loginRes.text());
        return;
    }

    const { session } = await loginRes.json();
    const token = session.access_token;
    console.log('Login successful.');

    console.log('2. Firing 10 concurrent requests to /tasks/automations/run ...');

    // Create an array of 10 promises
    const requests = Array(10).fill(0).map((_, i) =>
        fetch(`${BASE_URL}/api/tasks/automations/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }).then(res => res.json().then(data => ({ status: res.status, data, i })))
    );

    const results = await Promise.all(requests);

    console.log('Requests completed. Results:');
    let successCount = 0;
    let createdCounts = 0;

    results.forEach(r => {
        if (r.data.createdCount > 0) createdCounts += r.data.createdCount;
        console.log(`Req ${r.i}: Status ${r.status}, Created: ${r.data.createdCount}, Msg: ${r.data.message}`);
    });

    console.log('------------------------------------------------');
    console.log(`Total tasks reportedly created: ${createdCounts}`);
    if (createdCounts <= 1) {
        // logic: if there are ANY birthdays, createdCounts sum should be exactly equal to that number (likely 1 or 2).
        // It should NOT be roughly 10x that number.
        console.log('SUCCESS: Total created matches expected behavior (idempotency).');
    } else {
        console.log('WARNING: Total created count > expected (unless you have many birthdays today). Check logs.');
    }
}

verify().catch(console.error);
