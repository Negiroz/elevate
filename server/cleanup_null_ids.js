import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('../database.sqlite');
const db = new sqlite3.Database(dbPath);

const cleanup = async () => {
    console.log("Checking for records with NULL or empty IDs...");

    db.all("SELECT * FROM profiles WHERE id IS NULL OR id = ''", [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(`Found ${rows.length} profiles with invalid IDs:`);
        rows.forEach(r => console.log(` - ${r.first_name} ${r.last_name} (Role: ${r.role})`));

        if (rows.length > 0) {
            console.log("Deleting invalid records...");
            // Manual delete for these specific anomalies
            db.run("DELETE FROM profiles WHERE id IS NULL OR id = ''", [], function (err) {
                if (err) console.error("Error deleting:", err);
                else console.log(`Deleted ${this.changes} records.`);
            });

            // Also clean up dirty references if any (though without ID we can't link them easily, 
            // but maybe where member_id is null?)
            db.run("DELETE FROM cell_attendance WHERE member_id IS NULL OR member_id = ''");
            db.run("DELETE FROM tasks WHERE assigned_to_id IS NULL OR assigned_to_id = ''");
        } else {
            console.log("No invalid records found. The issue might be elsewhere (e.g., API not returning ID column).");

            // Debug: check "Prueba 100" specifically
            db.all("SELECT id, first_name, last_name FROM profiles WHERE first_name LIKE '%Prueba%'", [], (err, rows) => {
                console.log("Debug: All 'Prueba' records:");
                console.log(rows);
            });
        }
    });
};

cleanup();
