const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = 'dev-secret-key-change-in-prod';
const token = jwt.sign({ id: 'admin-id', email: 'admin@test.com', role: 'Administrador' }, SECRET, { expiresIn: '1h' });

const runTest = async () => {
    // 1. Get Stages
    const stages = await getStages();
    const lowStage = stages.find(s => s.position === 0); // Nuevo (0 steps)
    const highStage = stages.find(s => s.position === 4); // En Célula (Should complete up to index 2)

    // 2. Create User with Low Stage
    console.log("Creating user with low stage...");
    const id = await createProfile({
        first_name: "UpdateAutoStep",
        last_name: "Test",
        role: "Miembro",
        active: true,
        consolidation_stage_id: lowStage.id
    });

    // 3. Verify 0 steps completed
    await checkSteps(id, "Initial (Low Stage)");

    // 4. Update to High Stage
    console.log("Updating user to high stage...");
    await updateProfile(id, { consolidation_stage_id: highStage.id });

    // 5. Verify steps completed
    await checkSteps(id, "After Update (High Stage)");
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

function updateProfile(id, payload) {
    return new Promise((resolve) => {
        const data = JSON.stringify(payload);
        const req = http.request({
            hostname: 'localhost', port: 3002, path: `/api/profiles/${id}`, method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        }, (res) => {
            resolve();
        });
        req.write(data);
        req.end();
    });
}

function checkSteps(id, label) {
    return new Promise((resolve) => {
        http.get(`http://localhost:3002/api/profiles/${id}/steps`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                const steps = JSON.parse(body);
                const completedCount = steps.filter(s => s.completed).length;
                console.log(`[${label}] Total Steps: ${steps.length}, Completed: ${completedCount}`);
                // Debug specific steps
                const step0 = steps.find(s => s.step_order === 0);
                const step2 = steps.find(s => s.step_order === 2);
                console.log(`   Step 0 (Index 0): ${step0 ? step0.completed : 'N/A'}`);
                console.log(`   Step 2 (Index 2): ${step2 ? step2.completed : 'N/A'}`);
                resolve();
            });
        });
    });
}

runTest();
