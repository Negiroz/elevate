import db, { run, query } from './server/database.js';
import http from 'http';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function regenerate() {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${mm}-${dd}`;

    console.log(`Deleting automation tasks for ${todayStr}...`);
    await run("DELETE FROM tasks WHERE category = 'automation' AND due_date = ?", [todayStr]);
    console.log('Deleted.');

    console.log('Triggering automation...');

    // Check if test admin exists, if not create
    try {
        const testUser = await new Promise(r => db.get("SELECT * FROM profiles WHERE email='testadmin@test.com'", (e, row) => r(row)));
        if (!testUser) {
            const hash = await bcrypt.hash('test1234', 10);
            await run("INSERT INTO profiles (id, first_name, last_name, email, password_hash, role, active) VALUES (?,?,?,?,?,?,?)",
                [uuidv4(), 'Test', 'Admin', 'testadmin@test.com', hash, 'Administrador', 1]);
        }
    } catch (e) { }

    const request = (options, data) => new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ s: res.statusCode, b: body }));
        });
        if (data) req.write(JSON.stringify(data));
        req.end();
    });

    const loginRes = await request({
        hostname: 'localhost',
        port: 3002,
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'testadmin@test.com', password: 'test1234' });

    let token;
    if (loginRes.s === 200) {
        token = JSON.parse(loginRes.b).session.access_token;
    } else {
        console.log("Login failed. Check server log.");
        return;
    }

    // 2. Trigger
    const runRes = await request({
        hostname: 'localhost',
        port: 3002,
        path: '/api/tasks/automations/run',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    console.log('Trigger output:', runRes.b);

    // 3. Verify Description
    const tasks = await new Promise(r => db.all("SELECT description, due_date, created_at FROM tasks WHERE category='automation' ORDER BY created_at DESC LIMIT 1", (e, rows) => r(rows)));
    if (tasks.length > 0) {
        console.log(`New Task Description Sample (Due: ${tasks[0].due_date}, Created: ${tasks[0].created_at}):`);
        console.log(tasks[0].description);
    } else {
        console.log('No tasks created (maybe no birthdays today).');
    }
}

regenerate();
