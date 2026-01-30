
import { query } from './server/database.js';

async function checkOldAges() {
    try {
        const users = await query(`
            SELECT id, first_name, last_name, birth_date,
            (strftime('%Y', 'now') - strftime('%Y', birth_date)) as age
            FROM profiles 
            WHERE (strftime('%Y', 'now') - strftime('%Y', birth_date)) >= 80
        `);
        console.log('Users aged 80+:', users);
    } catch (err) {
        console.error(err);
    }
}

checkOldAges();
