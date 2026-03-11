
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');

async function getUser() {
    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        const user = await db.get("SELECT email FROM profiles WHERE email IS NOT NULL AND email != '' LIMIT 1");
        console.log("Found user:", user);
    } catch (err) {
        console.error("Error:", err);
    }
}

getUser();
