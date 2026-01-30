import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const dbPath = path.resolve('./database.sqlite');
const db = new sqlite3.Database(dbPath);

const newStages = [
    { t: 'Nuevo', c: '#3B82F6', p: 0 },
    { t: 'Por contactar', c: '#F59E0B', p: 1 },
    { t: 'Agendados', c: '#10B981', p: 2 },
    { t: 'En visitas', c: '#6366F1', p: 3 },
    { t: 'En Célula', c: '#8B5CF6', p: 4 },
    { t: 'Encuentristas', c: '#EC4899', p: 5 },
    { t: 'Bautizados', c: '#EF4444', p: 6 }
];

db.serialize(() => {
    console.log("Resetting Consolidation Stages...");

    // 1. Unlink existing profiles from stages (set to NULL) to confirm foreign key constraints don't block deletion
    db.run("UPDATE profiles SET consolidation_stage_id = NULL", (err) => {
        if (err) console.error("Error unlinking profiles:", err);
        else console.log("Profiles unlinked from old stages.");

        // 2. Delete all existing stages
        db.run("DELETE FROM consolidation_stages", (err) => {
            if (err) console.error("Error deleting old stages:", err);
            else {
                console.log("Old stages deleted.");

                // 3. Insert new stages
                const stmt = db.prepare("INSERT INTO consolidation_stages (id, title, color, position) VALUES (?, ?, ?, ?)");
                newStages.forEach(s => {
                    stmt.run(uuidv4(), s.t, s.c, s.p);
                });
                stmt.finalize(() => {
                    console.log("New stages inserted successfully.");
                });
            }
        });
    });
});
