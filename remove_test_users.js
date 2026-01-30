import { run, query } from './server/database.js';

async function cleanup() {
    try {
        console.log("Searching for test users to remove...");

        // Find them first to log
        const users = await query(`
            SELECT id, first_name, last_name, email 
            FROM profiles 
            WHERE first_name LIKE '%NullEmail%' 
            OR first_name LIKE '%EmptyString%' 
            OR first_name LIKE '%EncuentroTest%'
            OR last_name LIKE '%Member%' AND first_name LIKE '%Test%'
        `);

        if (users.length === 0) {
            console.log("No test users found.");
            return;
        }

        console.log(`Found ${users.length} test users. Deleting...`);
        console.table(users);

        for (const user of users) {
            // Delete from other tables first if needed (cascade might handle it but let's be safe if no cascade)
            // Actually, usually we rely on foreign keys or just delete profile.
            // Our schema might fallback to NULL on delete or cascade. 
            // Let's just delete the profile.
            await run('DELETE FROM tasks WHERE related_member_id = ?', [user.id]);
            await run('DELETE FROM cell_attendance WHERE member_id = ?', [user.id]);
            await run('DELETE FROM consolidation_steps WHERE profile_id = ?', [user.id]);
            await run('DELETE FROM profiles WHERE id = ?', [user.id]);
        }

        console.log("Cleanup complete.");
    } catch (err) {
        console.error("Error during cleanup:", err);
    }
}

cleanup();
