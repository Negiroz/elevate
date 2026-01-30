import { query } from './server/database.js';

async function checkSchema() {
    try {
        const columns = await query("PRAGMA table_info(profiles)");
        console.table(columns);
    } catch (err) {
        console.error(err);
    }
}
checkSchema();
