
import { run } from './server/database.js';

async function cleanup() {
    console.log("Cleaning up test users...");
    await run("DELETE FROM profiles WHERE email LIKE 'user%@test.com'");
    await run("VACUUM"); // Reclaim space
    console.log("Cleanup complete.");
}

cleanup();
