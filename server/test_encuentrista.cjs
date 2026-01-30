const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = 'dev-secret-key-change-in-prod';
const token = jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'Administrador' }, SECRET, { expiresIn: '1h' });

const runTest = async () => {
    // 1. Get Stages
    const stages = await getStages();
    const encId = stages.find(s => s.position === 5).id;

    // 2. Create User
    const id = await createProfile({
        first_name: "EncuentroTest",
        last_name: "User",
        role: "Miembro",
        active: true,
        consolidation_stage_id: encId
    });

    // 3. Verify
    await checkSteps(id);
};

function getStages() {
    return new Promise((resolve) => {
        http.get('http://localhost:3002/api/consolidation_stages', {
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve(JSON.parse(body)));
        });
    });
}

function createProfile(payload) {
    return new Promise((resolve) => {
        const data = JSON.stringify(payload);
        const req = http.request({
            hostname: 'localhost', port: 3002, path: '/api/profiles', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve(JSON.parse(body).id));
        });
        req.write(data);
        req.end();
    });
}

function checkSteps(id) {
    return new Promise((resolve) => {
        http.get(`http://localhost:3002/api/profiles/${id}/steps`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                const steps = JSON.parse(body);
                const completedCount = steps.filter(s => s.completed).length;
                console.log(`Total Steps: ${steps.length}, Completed: ${completedCount} (Expected 12)`);
                // Check 'Encuentro' step (Index 11)
                const encStep = steps.find(s => s.step_order === 11);
                console.log(`Encuentro Step (11): ${encStep ? encStep.completed : 'Not Found'}`);
                resolve();
            });
        });
    });
}

runTest();
