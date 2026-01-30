const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Adding indexes to database...');

db.serialize(() => {
    // Indexes for Profiles (frequent filtering)
    db.run("CREATE INDEX IF NOT EXISTS idx_profiles_district ON profiles(district_id)", (err) => {
        if (err) console.error('Error adding idx_profiles_district:', err);
        else console.log('Index added: idx_profiles_district');
    });

    db.run("CREATE INDEX IF NOT EXISTS idx_profiles_cell ON profiles(cell_id)", (err) => {
        if (err) console.error('Error adding idx_profiles_cell:', err);
        else console.log('Index added: idx_profiles_cell');
    });

    db.run("CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(active)", (err) => {
        if (err) console.error('Error adding idx_profiles_active:', err);
        else console.log('Index added: idx_profiles_active');
    });

    // Indexes for Attendance (frequent querying by date/member)
    db.run("CREATE INDEX IF NOT EXISTS idx_attendance_date ON cell_attendance(date)", (err) => {
        if (err) console.error('Error adding idx_attendance_date:', err);
        else console.log('Index added: idx_attendance_date');
    });

    db.run("CREATE INDEX IF NOT EXISTS idx_attendance_member ON cell_attendance(member_id)", (err) => {
        if (err) console.error('Error adding idx_attendance_member:', err);
        else console.log('Index added: idx_attendance_member');
    });

    // Indexes for Tasks (filtering by status/assigned)
    db.run("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)", (err) => {
        if (err) console.error('Error adding idx_tasks_status:', err);
        else console.log('Index added: idx_tasks_status');
    });

    db.run("CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to_id)", (err) => {
        if (err) console.error('Error adding idx_tasks_assigned:', err);
        else console.log('Index added: idx_tasks_assigned');
    });

});

db.close((err) => {
    if (err) console.error('Error closing DB:', err);
    else console.log('Indexes applied successfully.');
});
