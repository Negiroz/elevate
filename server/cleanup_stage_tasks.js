import { run } from './database.js';

async function cleanup() {
    try {
        console.log('Cleaning up stage automation tasks...');
        const result = await run(`
            DELETE FROM tasks 
            WHERE description LIKE 'Automatización por etapa:%'
        `);
        console.log(`Deleted ${result.changes} tasks.`);
    } catch (error) {
        console.error('Error cleaning up tasks:', error);
    }
}

cleanup();
