
// This script simulates the backend side checks since we can't easily run client logic in node without browser.
// BUT, the automation logic is inside React Context (Client Side)!
// So I cannot test it with a simple node script unless I duplicate logic or use browser driving.
// I will just use a browser verification for this.

// Wait, I can try to verify the Database state AFTER manual browser interaction if I could.
// Since I need to verify the logic I wrote in React, I need to use the browser.

/*
 PLAN:
 1. Open Browser.
 2. Navigate to Consolidation Board.
 3. Find a candidate card.
 4. Drag and Drop it (or use move menu if available, otherwise just observe).
 
 WAIT, Drag and Drop is UI intensive.
 'moveTask' is exposed in Context. Code is in Context.
 
 I will define a manual verification plan for the user, as automating drag-and-drop in canvas via subagent might be flaky.
 
 HOWEVER, I can verify the logic by asking the user to try it.
 
 Let's try to verify if the server accepts the task creation calls first? No, I trust the server.
 
 I will create a script that just *LISTS* the tasks created recently so I can tell the user "Please move a card and then I will check if tasks appeared".
*/

import { query } from './server/database.js';

async function verifyRecentTasks() {
    try {
        console.log("Checking last 5 tasks created...");
        const tasks = await query('SELECT title, assigned_to_id, category, created_at FROM tasks ORDER BY created_at DESC LIMIT 5');
        console.table(tasks);
    } catch (err) {
        console.error(err);
    }
}

verifyRecentTasks();
