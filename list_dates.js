
import { query } from './server/database.js';

async function listDates() {
    try {
        const users = await query(`
            SELECT id, first_name, last_name, birth_date,
            strftime('%Y', birth_date) as year,
            strftime('%Y', 'now') as now
            FROM profiles 
            WHERE birth_date IS NOT NULL
        `);
        console.log('Birth Dates:', users);
    } catch (err) {
        console.error(err);
    }
}

listDates();
