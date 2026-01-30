const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.each("SELECT id, email, first_name FROM profiles WHERE email IS NULL OR email = ''", (err, row) => {
        console.log(`ID: ${row.id}, Name: ${row.first_name}, Email: '${row.email}' (Type: ${typeof row.email})`);
    });
});

db.close();
