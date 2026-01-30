import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('./database.sqlite');
const db = new sqlite3.Database(dbPath);

db.run("DELETE FROM profiles WHERE email = 'supervisor2@test.com'", (err) => {
    if (err) console.error(err);
    else console.log("Test user deleted");
});
