
import { query } from './server/database.js';

async function inspect() {
    try {
        const profileCount = await query('SELECT count(*) as count FROM profiles');
        console.log('Profile Count:', profileCount[0].count);

        const profiles = await query('SELECT id, first_name, last_name, district_id, cell_id FROM profiles LIMIT 5');
        console.log('Sample Profiles:', profiles);

        const districts = await query('SELECT * FROM districts LIMIT 5');
        console.log('Sample Districts:', districts);

        const cells = await query('SELECT * FROM cells LIMIT 5');
        console.log('Sample Cells:', cells);

    } catch (err) {
        console.error('Error:', err);
    }
}

inspect();
