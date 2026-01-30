
// Import from the helper which is already set up
import { query } from './server/database.js';

async function verify() {
    try {
        const rows = await query('SELECT title, position FROM consolidation_stages ORDER BY position');
        console.table(rows);
    } catch (err) {
        console.error(err);
    }
}

verify();
