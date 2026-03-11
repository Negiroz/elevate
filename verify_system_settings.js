
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');

async function checkTable() {
    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        const table = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'");
        if (table) {
            console.log("Table 'system_settings' exists.");
            const rows = await db.all("SELECT * FROM system_settings");
            console.log("Table content:", rows);
        } else {
            console.log("Table 'system_settings' DOES NOT exist.");
        }
    } catch (err) {
        console.error("Error checking database:", err);
    }
}

checkTable();
