const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = 'dev-secret-key-change-in-prod';
const token = jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'Administrador' }, SECRET, { expiresIn: '1h' });

const runTest = async () => {
    // 1. Get Bautizado Stage ID
    const stages = await getStages();
    const bautizadoStage = stages.find(s => s.position === 6);

    if (!bautizadoStage) {
        console.error("No Bautizado stage found");
        return;
    }

    // 2. Create User with Bautizado Stage
    const id = await createProfile({
        first_name: "AutoStep",
        last_name: "Test",
        role: "Miembro",
        active: true,
        consolidation_stage_id: bautizadoStage.id
    });

    // 3. Check Steps
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
                console.log(`Total Steps: ${steps.length}, Completed: ${completedCount}`);
                console.log('Sample Step 0:', steps[0]);
                resolve();
            });
        });
    });
}

runTest();
