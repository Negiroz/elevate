
import { run } from './server/database.js';
import { v4 as uuidv4 } from 'uuid';

async function seedMassive() {
    console.log("Seeding 3000 users...");
    const values = [];
    const placeholders = [];

    // Batch insert using transaction for speed
    await run('BEGIN TRANSACTION');

    try {
        for (let i = 0; i < 3000; i++) {
            const id = uuidv4();
            await run(`INSERT INTO profiles (id, first_name, last_name, email, role, active, gender, birth_date) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, `User${i}`, `Test${i}`, `user${i}@test.com`, 'Miembro', 1, i % 2 === 0 ? 'Masculino' : 'Femenino', '1990-01-01']);
        }
        await run('COMMIT');
        console.log("Seeding complete.");
    } catch (e) {
        await run('ROLLBACK');
        console.error(e);
    }
}

seedMassive();
