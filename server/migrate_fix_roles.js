import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('./database.sqlite');
console.log(`Migrating database at ${dbPath}`);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Rename existing
    db.run("ALTER TABLE profiles RENAME TO profiles_backup", (err) => {
        if (err) {
            if (err.message.includes('no such table')) {
                console.log('Table profiles does not exist, creating fresh...');
            } else {
                console.error('Error renaming:', err);
                return;
            }
        } else {
            console.log("Profiles table renamed to profiles_backup");
        }

        // 2. Create new table (Constraint-free role)
        db.run(`CREATE TABLE IF NOT EXISTS profiles (
              id TEXT PRIMARY KEY,
              first_name TEXT,
              last_name TEXT,
              email TEXT UNIQUE,
              password_hash TEXT,
              role TEXT,
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
            )`, (err) => {
            if (err) console.error("Error creating new table:", err);
            else console.log("New profiles table created");

            // 3. Copy Data
            db.run(`INSERT INTO profiles SELECT * FROM profiles_backup`, (err) => {
                if (err) console.error("Error copying data:", err);
                else {
                    console.log("Data copied successfully");

                    // 4. Update legacy roles if needed
                    db.run("UPDATE profiles SET role = 'Administrador' WHERE role = 'Admin'", (err) => {
                        console.log("Updated Admin role");

                        // 5. Drop backup
                        db.run("DROP TABLE profiles_backup", (err) => {
                            if (err) console.error("Error dropping backup:", err);
                            else console.log("Migration complete.");
                        });
                    });
                }
            });
        });
    });
});
