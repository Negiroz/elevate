import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('./database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT email, password_hash, role FROM profiles LIMIT 5", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Users found:', rows);
});
