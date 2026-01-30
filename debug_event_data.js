import { query } from './server/database.js';

async function debugEventData() {
    try {
        console.log("--- Debugging Event Data ---");
        // Get all events
        const events = await query('SELECT id, name FROM events');
        console.table(events);

        if (events.length > 0) {
            const eventId = events[0].id; // Pick first event or specific one if known
            console.log(`\nChecking details for event: ${events[0].name} (${eventId})`);

            // Test the exact query from routes.js
            const retention = await query(`
                SELECT count(*) as count 
                FROM profiles 
                WHERE conversion_event_id = ? 
                AND active != 0 
                AND active IS NOT NULL
            `, [eventId]);

            console.log("Retention Count from Query:", retention[0].count);

            // Check individual rows again
            const rows = await query(`
                SELECT id, first_name, conversion_event_id, active 
                FROM profiles 
                WHERE conversion_event_id = ?
            `, [eventId]);
            console.table(rows);
        }
    } catch (err) {
        console.error(err);
    }
}

debugEventData();
