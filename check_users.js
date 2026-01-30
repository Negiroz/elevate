import { query } from './server/database.js';

async function check() {
    try {
        const users = await query('SELECT id, first_name, last_name, email, role FROM profiles');
        console.table(users);
    } catch (err) {
        console.error(err);
    }
}

check();
