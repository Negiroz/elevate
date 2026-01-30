
import { run, get } from './database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function createAdmin() {
    const email = 'admin_test@test.com';
    const password = 'password123';
    const hash = await bcrypt.hash(password, 10);

    try {
        const existing = await get('SELECT * FROM profiles WHERE email = ?', [email]);
        if (existing) {
            console.log('User already exists, updating password...');
            await run('UPDATE profiles SET password_hash = ?, role = "Administrador", active = 1 WHERE email = ?', [hash, email]);
        } else {
            console.log('Creating new admin user...');
            const id = uuidv4();
            await run(`INSERT INTO profiles (id, first_name, last_name, email, password_hash, role, active, join_date) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, 'Admin', 'Test', email, hash, 'Administrador', 1, new Date().toISOString()]);
        }
        console.log('Admin user ready: admin_test@test.com / password123');
    } catch (err) {
        console.error('Error creating admin:', err);
    }
}

createAdmin();
