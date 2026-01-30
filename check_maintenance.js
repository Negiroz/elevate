import { get } from './server/database.js';

async function checkMaintenance() {
    try {
        const setting = await get('SELECT * FROM system_settings WHERE key = ?', ['maintenance_mode']);
        console.log('Maintenance Mode Setting:', setting);
    } catch (err) {
        console.error('Error:', err);
    }
}

checkMaintenance();
