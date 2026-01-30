
import { run, get, query } from './server/database.js';

async function verifyCellData() {
    try {
        console.log("Checking Cell P01...");

        // 1. Find the cell ID for 'P01' (it might be a name, not ID)
        const cells = await query("SELECT * FROM cells WHERE name LIKE '%P01%' OR name LIKE '%p01%'");
        console.log(`Found ${cells.length} cells matching 'P01':`);
        cells.forEach(c => console.log(` - ID: ${c.id}, Name: ${c.name}, District: ${c.district_id}`));

        if (cells.length === 0) {
            console.log("No cell found with name 'P01'. Checking if it's used as an ID directly...");
        }

        // 2. Count users in these cells
        for (const cell of cells) {
            const users = await query("SELECT id, first_name, last_name, role, active, district_id FROM profiles WHERE cell_id = ?", [cell.id]);
            console.log(`\nUsers in Cell '${cell.name}' (ID: ${cell.id}): ${users.length}`);
            // Log a few users to see potential issues (isActive, role, etc)
            users.slice(0, 5).forEach(u => console.log(`   - ${u.first_name} ${u.last_name} (${u.role}) Active: ${u.active} District: ${u.district_id}`));
        }

        // 3. Just in case 'P01' is being stored as the cell_id string directly instead of UUID
        const directUsers = await query("SELECT count(*) as count FROM profiles WHERE cell_id = 'P01'");
        console.log(`\nUsers with cell_id exact match 'P01': ${directUsers[0].count}`);

    } catch (err) {
        console.error("Error:", err);
    }
}

verifyCellData();
