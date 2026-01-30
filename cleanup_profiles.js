
import { run } from './server/database.js';

async function cleanup() {
    try {
        console.log("Deleting profiles with NULL id...");
        await run('DELETE FROM profiles WHERE id IS NULL');
        console.log("Cleanup complete.");
    } catch (err) {
        console.error(err);
    }
}

cleanup();
