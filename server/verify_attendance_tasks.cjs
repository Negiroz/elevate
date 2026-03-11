const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SECRET = 'dev-secret-key-change-in-prod';
const token = jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'Administrador' }, SECRET, { expiresIn: '1h' });

const API_BASE = 'http://localhost:3002/api';

async function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: `/api${path}`,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(data ? JSON.parse(data) : {});
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function verifyAutomation() {
    console.log('--- Verification: Attendance Task Automation ---');

    // 1. Setup Test Data
    const districtId = uuidv4();
    const cellId = uuidv4();
    const leaderId = uuidv4();
    const supervisorId = uuidv4();
    const memberId = uuidv4();

    console.log('Creating test district, cell, and profiles...');
    await request('/districts', 'POST', { id: districtId, name: 'Test District', supervisor_id: supervisorId, active: 1 });
    await request('/profiles', 'POST', { id: supervisorId, first_name: 'Super', last_name: 'Visor', role: 'Supervisor de Distrito', district_id: districtId });
    await request('/cells', 'POST', { id: cellId, name: 'Test Cell', leader_id: leaderId, district_id: districtId });
    await request('/profiles', 'POST', { id: leaderId, first_name: 'Líder', last_name: 'Célula', role: 'Líder de Célula', cell_id: cellId });
    await request('/profiles', 'POST', { id: memberId, first_name: 'Test', last_name: 'Member', role: 'Miembro', cell_id: cellId, district_id: districtId });

    const checkTasks = async (expectedCount, label) => {
        const tasks = await request(`/tasks?related_member_id=${memberId}`);
        console.log(`[${label}] Tasks found: ${tasks.length}`);
        return tasks;
    };

    // 2. Test 3 Absences
    console.log('\nRegistering 3 absences...');
    const dates = ['2026-02-20', '2026-02-21', '2026-02-22'];
    for (const date of dates) {
        await request('/attendance', 'POST', {
            attendanceRecords: [{ member_id: memberId, cell_id: cellId, date: date, status: 'absent', type: 'cell' }]
        });
    }

    await new Promise(r => setTimeout(r, 500)); // Wait for automation
    const tasks3 = await checkTasks(1, 'Streak: 3');
    if (tasks3.some(t => t.title.includes('Visita de cercanía') && t.assigned_to_id === leaderId)) {
        console.log('✅ Task for Cell Leader created correctly.');
    } else {
        console.log('❌ Task for Cell Leader NOT found or incorrect.');
        console.log('Found tasks:', tasks3.map(t => t.title));
    }

    // 3. Test 4 Absences
    console.log('\nRegistering 4th absence...');
    await request('/attendance', 'POST', {
        attendanceRecords: [{ member_id: memberId, cell_id: cellId, date: '2026-02-23', status: 'absent', type: 'cell' }]
    });

    await new Promise(r => setTimeout(r, 500)); // Wait for automation
    const tasks4 = await checkTasks(2, 'Streak: 4');
    if (tasks4.some(t => t.title.includes('Visita de supervisor') && t.assigned_to_id === supervisorId)) {
        console.log('✅ Task for Supervisor created correctly.');
    } else {
        console.log('❌ Task for Supervisor NOT found or incorrect.');
        console.log('Found tasks:', tasks4.map(t => t.title));
    }

    // 4. Test 5 Absences
    console.log('\nRegistering 5th absence...');
    await request('/attendance', 'POST', {
        attendanceRecords: [{ member_id: memberId, cell_id: cellId, date: '2026-02-24', status: 'absent', type: 'cell' }]
    });

    const tasks5 = await checkTasks(3, 'Streak: 5');
    if (tasks5.some(t => t.title.includes('Atención Pastoral'))) {
        console.log('✅ Task for Pastor created correctly.');
    } else {
        console.log('❌ Task for Pastor NOT found or incorrect.');
    }

    console.log('\n--- Verification Finished ---');
}

verifyAutomation().catch(console.error);
