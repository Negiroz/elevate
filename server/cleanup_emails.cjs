const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Convert any existing empty string emails to NULL
    db.run("UPDATE profiles SET email = NULL WHERE email = '' OR email = ' '", function (err) {
        if (err) {
            console.error("Error updating profiles:", err.message);
        } else {
            console.log(`Cleaned up ${this.changes} rows with empty email strings.`);
        }
    });
});

db.close();
