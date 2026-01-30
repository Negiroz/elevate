
import { run } from './database.js';

async function migrate() {
    try {
        console.log('Adding visit_date column...');
        await run('ALTER TABLE profiles ADD COLUMN visit_date TEXT');
    } catch (e) {
        console.log('visit_date column might already exist:', e.message);
    }

    try {
        console.log('Adding notes column...');
        await run('ALTER TABLE profiles ADD COLUMN notes TEXT');
    } catch (e) {
        console.log('notes column might already exist:', e.message);
    }

    console.log('Migration completed.');
}

migrate();
