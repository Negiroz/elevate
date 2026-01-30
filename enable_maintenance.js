import { run } from './server/database.js';

async function enableMaintenance() {
    try {
        await run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('maintenance_mode', 'true')");
        console.log('Maintenance Mode Enabled');
    } catch (err) {
        console.error('Error:', err);
    }
}

enableMaintenance();
