
import { query } from './server/database.js';

async function checkAudit() {
    console.log("Checking Audit Queries...");

    // 1. Check total active users
    const totalActive = await query(`SELECT count(*) as c FROM profiles WHERE active = 1`);
    console.log(`Total Active Users: ${totalActive[0].c}`);

    // 2. Check unassigned cell users (Raw)
    const rawUnassigned = await query(`SELECT count(*) as c FROM profiles WHERE active = 1 AND (cell_id IS NULL OR cell_id = '')`);
    console.log(`Unassigned Cell (Active): ${rawUnassigned[0].c}`);

    // 3. Check Roles of these unassigned users
    const rolesUnassigned = await query(`SELECT role, count(*) as c FROM profiles WHERE active = 1 AND (cell_id IS NULL OR cell_id = '') GROUP BY role`);
    console.log("Roles of Unassigned Users:");
    console.table(rolesUnassigned);

    // 4. Test the Audit Query Logic (with exclusions)
    const excludedRoles = ['admin', 'pastor', 'supervisor', 'Administrador', 'Pastor', 'Supervisor de Distrito'];
    // Note: Since I can't pass array to NOT IN easily with this helper relying on strict param mapping if logic is manual, 
    // I will use strict string for the query to match route logic exactly or use the same logic if possible.
    // The route uses: AND role NOT IN ('admin', ...) literal string in the query text.

    try {
        const issues = {};

        console.log("Running Query 1 (Users Without Cell)...");
        issues.usersWithoutCell = await query(`
            SELECT id, first_name, last_name, role 
            FROM profiles 
            WHERE active = 1 
            AND role NOT IN ('admin', 'pastor', 'supervisor', 'Administrador', 'Pastor', 'Supervisor de Distrito')
            AND (cell_id IS NULL OR cell_id = '')
        `);
        console.log(`[OK] Users without cell: ${issues.usersWithoutCell.length}`);

        console.log("Running Query 2 (Users Without Leader)...");
        issues.usersWithoutLeader = await query(`
            SELECT p.id, p.first_name, p.last_name, p.role 
            FROM profiles p
            LEFT JOIN cells c ON p.cell_id = c.id
            WHERE p.active = 1 
            AND p.role NOT IN ('admin', 'pastor', 'Administrador', 'Pastor')
            AND p.cell_id IS NOT NULL AND p.cell_id != ''
            AND (c.leader_id IS NULL OR c.leader_id = '')
        `);
        console.log(`[OK] Users without leader: ${issues.usersWithoutLeader.length}`);

        console.log("Running Query 3 (Cells Without Leader)...");
        issues.cellsWithoutLeader = await query(`
            SELECT id, name 
            FROM cells 
            WHERE (leader_id IS NULL OR leader_id = '')
        `);
        console.log(`[OK] Cells without leader: ${issues.cellsWithoutLeader.length}`);

        console.log("Running Query 4 (Incomplete Profiles)...");
        issues.incompleteProfiles = await query(`
            SELECT id, first_name, last_name, phone, address 
            FROM profiles 
            WHERE active = 1 AND (phone IS NULL OR phone = '' OR address IS NULL OR address = '')
        `);
        console.log(`[OK] Incomplete Profiles: ${issues.incompleteProfiles.length}`);

        console.log("SUCCESS! All queries ran.");
    } catch (err) {
        console.error("CRASHED:", err);
    }
}

checkAudit();
