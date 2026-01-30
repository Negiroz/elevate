
import { query } from './server/database.js';

async function verify() {
    try {
        const rows = await query('SELECT id, first_name, email FROM profiles');
        console.log("Profiles count:", rows.length);
        console.table(rows);

        const invalid = rows.filter(r => !r.id);
        if (invalid.length > 0) {
            console.error("FOUND PROFILES WITH NULL/EMPTY ID:", invalid);
        } else {
            console.log("All profiles have IDs.");
        }
    } catch (err) {
        console.error(err);
    }
}

verify();
