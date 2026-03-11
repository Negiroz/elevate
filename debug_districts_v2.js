
import { query } from './server/database.js';

async function test() {
    try {
        console.log('Testing District Query...');
        const districts = await query(`
            SELECT d.*, p.first_name as supervisor_first_name, p.last_name as supervisor_last_name 
            FROM districts d
            LEFT JOIN profiles p ON d.supervisor_id = p.id
            ORDER BY d.name
        `);
        console.log(`Found ${districts.length} districts.`);
        if (districts.length > 0) {
            console.log('Sample District:', JSON.stringify(districts[0], null, 2));
        }
        process.exit(0);
    } catch (e) {
        console.error('Query Failed:', e);
        process.exit(1);
    }
}

test();
