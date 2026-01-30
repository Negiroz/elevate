const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='consolidation_steps'", (err, row) => {
        if (err) {
            console.error(err);
        } else {
            console.log(row ? row.sql : "Table not found");
        }
    });
});

db.close();
