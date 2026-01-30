
import { query } from './server/database.js';

async function testFilterLogic() {
    try {
        console.log("Starting Filter Logic Test...");

        // Mock parameters - Mimic what happens in server/routes.js
        // Case 1: Filter by Cell P01
        // First get the ID for P01
        const cells = await query("SELECT id FROM cells WHERE name LIKE '%P01%'");
        if (cells.length === 0) {
            console.error("Could not find Cell P01 to test.");
            return;
        }
        const targetCellId = cells[0].id;
        console.log(`Testing with Cell ID: ${targetCellId} (P01)`);

        // Mock Request Query
        const mockQuery = {
            district: 'Todos', // or undefined
            cell: targetCellId,
            q: undefined
        };

        // Mock Access Scope (Admin/None)
        const access = { scope: 'none', districtIds: [], cellIds: [] };
        // Note: 'none' in current logic means "only my own profile" which is WRONG for admin!
        // Wait, let's check getAccessScope logic for admin. 
        // Usually admin returns scope: 'all' or similar?
        // If I assume scope is 'all' (which isn't handled in the if/else chain I saw earlier), 
        // it means NO extra WHERE clauses are added.

        // Let's reconstruct the logic exactly as in server/routes.js:
        let whereClause = '1=1';
        let params = [];

        // START COPIED LOGIC
        if (access.scope === 'supervisor') {
            // ...
        } else if (access.scope === 'leader') {
            // ...
        } else if (access.scope === 'none') {
            // whereClause += ' AND p.id = ?'; // COMMENTED OUT: testing as if Admin (scope 'all')
            // params.push('ADMIN_ID');
        }

        // Optional User Filters (District/Cell)
        if (mockQuery.district && mockQuery.district !== 'Todos') {
            whereClause += ' AND p.district_id = ?';
            params.push(mockQuery.district);
        }

        if (mockQuery.cell && mockQuery.cell !== 'Todas') {
            whereClause += ' AND p.cell_id = ?';
            params.push(mockQuery.cell);
        }
        // END COPIED LOGIC

        console.log(`Generated SQL: SELECT count(*) as count FROM profiles p WHERE ${whereClause}`);
        console.log(`Params:`, params);

        const result = await query(`SELECT count(*) as count FROM profiles p WHERE ${whereClause}`, params);
        console.log(`Result Count: ${result[0].count}`);

        // Case 2: Filter by District
        const districts = await query("SELECT id FROM districts LIMIT 1");
        const targetDistrictId = districts[0].id;
        console.log(`\nTesting with District ID: ${targetDistrictId}`);

        let whereClause2 = '1=1';
        let params2 = [];

        // Apply District Filter
        whereClause2 += ' AND p.district_id = ?';
        params2.push(targetDistrictId);

        const result2 = await query(`SELECT count(*) as count FROM profiles p WHERE ${whereClause2}`, params2);
        console.log(`Result Count (District): ${result2[0].count}`);


    } catch (e) {
        console.error("Error:", e);
    }
}

testFilterLogic();
