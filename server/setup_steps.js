import { run } from './database.js';

async function setup() {
    try {
        console.log('Creating consolidation_steps table...');
        await run(`
            CREATE TABLE IF NOT EXISTS consolidation_steps (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                step_name TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                completed_at TEXT,
                step_order INTEGER NOT NULL,
                FOREIGN KEY (profile_id) REFERENCES profiles(id)
            )
        `);
        console.log('Table consolidation_steps created successfully.');
    } catch (error) {
        console.error('Error creating table:', error);
    }
}

setup();
