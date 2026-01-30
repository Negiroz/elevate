import { query } from './server/database.js';

async function checkActiveTypes() {
    try {
        console.log("Checking 'active' column values and types...");
        const rows = await query("SELECT id, first_name, active, typeof(active) as type FROM profiles WHERE conversion_event_id IS NOT NULL");
        console.table(rows);
    } catch (err) {
        console.error(err);
    }
}
checkActiveTypes();
