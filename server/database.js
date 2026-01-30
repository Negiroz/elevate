import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve('./database.sqlite');
console.log(`Loading database from ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Database connected');
        db.run('PRAGMA journal_mode = WAL;');
        initDb();
    }
});

// Helper to run queries as promises
export const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

export const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

export const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

function initDb() {
    db.serialize(() => {
        // 9. SYSTEM SETTINGS
        db.run(`CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        // 1. DISTRICTS
        db.run(`CREATE TABLE IF NOT EXISTS districts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      supervisor_id TEXT,
      active INTEGER DEFAULT 1,
      color TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

        // 2. CELLS
        db.run(`CREATE TABLE IF NOT EXISTS cells (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      leader_id TEXT,
      district_id TEXT,
      image_url TEXT,
      meeting_day TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(district_id) REFERENCES districts(id)
    )`);

        // 3. CONSOLIDATION STAGES
        db.run(`CREATE TABLE IF NOT EXISTS consolidation_stages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      color TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

        // 4. PROFILES
        db.run(`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT, -- NEW for local auth
      role TEXT, -- Removed restrictive CHECK to allow all system roles
      active INTEGER DEFAULT 1,
      image_url TEXT,
      district_id TEXT,
      cell_id TEXT,
      consolidation_stage_id TEXT,
      join_date TEXT DEFAULT CURRENT_TIMESTAMP,
      birth_date TEXT,
      marital_status TEXT,
      gender TEXT,
      profession TEXT,
      address TEXT,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(district_id) REFERENCES districts(id),
      FOREIGN KEY(cell_id) REFERENCES cells(id),
      FOREIGN KEY(consolidation_stage_id) REFERENCES consolidation_stages(id)
    )`);

        // 5. TASKS
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('pending', 'in-progress', 'completed', 'cancelled')),
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      category TEXT,
      due_date TEXT,
      assigned_to_id TEXT,
      created_by_user_id TEXT,
      related_member_id TEXT,
      feedback TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assigned_to_id) REFERENCES profiles(id),
      FOREIGN KEY(created_by_user_id) REFERENCES profiles(id),
      FOREIGN KEY(related_member_id) REFERENCES profiles(id)
    )`);

        // 6. CELL ATTENDANCE
        db.run(`CREATE TABLE IF NOT EXISTS cell_attendance (
      id TEXT PRIMARY KEY,
      cell_id TEXT,
      member_id TEXT,
      date TEXT NOT NULL,
      status TEXT,
      type TEXT, -- 'cell', 'service', 'event'
      event_id TEXT, -- New for event attendance
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(cell_id) REFERENCES cells(id),
      FOREIGN KEY(member_id) REFERENCES profiles(id),
      FOREIGN KEY(event_id) REFERENCES events(id)
    )`, (err) => {
            if (!err) {
                // MIGRATION: Add columns if missing
                db.run("ALTER TABLE cell_attendance ADD COLUMN type TEXT", () => { });
                db.run("ALTER TABLE cell_attendance ADD COLUMN event_id TEXT", () => { });
            }
        });

        // 6.5. OFFERING REPORTS
        db.run(`CREATE TABLE IF NOT EXISTS offering_reports (
            id TEXT PRIMARY KEY,
            cell_id TEXT,
            date TEXT,
            cash_bs REAL DEFAULT 0,
            cash_usd REAL DEFAULT 0,
            transfer REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(cell_id) REFERENCES cells(id)
        )`);

        // 7. EVENTS
        db.run(`CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      date TEXT,
      image_url TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

        // MIGRATION for Profiles: Add conversion fields
        db.run("ALTER TABLE profiles ADD COLUMN conversion_origin TEXT", () => { });
        db.run("ALTER TABLE profiles ADD COLUMN conversion_event_id TEXT", () => { });

        // 8. ANNOUNCEMENTS
        db.run(`CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT,
            image_url TEXT,
            active INTEGER DEFAULT 1,
            priority INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            created_by_user_id TEXT
        )`);

        // Seed Data if Empty
        checkAndSeed();
    });
}

async function checkAndSeed() {
    const row = await get("SELECT count(*) as count FROM profiles");
    if (row.count === 0) {
        console.log("Seeding database...");

        // Seed Stages
        const stages = [
            { t: 'Nuevo', c: '#3B82F6', p: 0 },
            { t: 'Por contactar', c: '#F59E0B', p: 1 },
            { t: 'Agendados', c: '#10B981', p: 2 },
            { t: 'En visitas', c: '#6366F1', p: 3 },
            { t: 'En Célula', c: '#8B5CF6', p: 4 },
            { t: 'Encuentristas', c: '#EC4899', p: 5 },
            { t: 'Bautizados', c: '#EF4444', p: 6 }
        ];

        for (const s of stages) {
            db.run(`INSERT INTO consolidation_stages (id, title, color, position) VALUES (?, ?, ?, ?)`,
                [uuidv4(), s.t, s.c, s.p]);
        }

        // Seed Admin
        const adminId = uuidv4();
        const hash = await bcrypt.hash('admin123', 10);
        db.run(`INSERT INTO profiles (id, first_name, last_name, email, password_hash, role, active) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [adminId, 'Admin', 'User', 'admin@elevate.com', hash, 'Administrador', 1]);

        console.log("Seeding complete. Default user: admin@elevate.com / admin123");
    }
}

export default db;
