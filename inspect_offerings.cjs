const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.all("SELECT * FROM offering_reports", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Offering Reports Count:", rows.length);
            console.log(JSON.stringify(rows, null, 2));
        }
    });
});

db.close();
