import { query, get, run } from './database.js';
import { v4 as uuidv4 } from 'uuid';

async function backfill() {
    console.log('--- Starting Attendance Task Backfill ---');
    try {
        // 1. Get all active members
        const members = await query("SELECT id, first_name, last_name, cell_id, district_id FROM profiles WHERE active = 1");
        console.log(`Processing ${members.length} members...`);

        const today = new Date().toISOString().split('T')[0];
        let createdCount = 0;

        for (const member of members) {
            // 2. Get last 6 attendance records for each
            const history = await query(`
                SELECT status, date FROM cell_attendance 
                WHERE member_id = ? 
                ORDER BY date DESC, created_at DESC
                LIMIT 6
            `, [member.id]);

            // 3. Calculate streak
            let streak = 0;
            for (const record of history) {
                if (record.status === 'absent') {
                    streak++;
                } else {
                    break;
                }
            }

            if (streak >= 3) {
                console.log(`Member ${member.first_name} ${member.last_name} (${member.id}) has streak: ${streak}`);

                let title = '';
                let description = '';
                let assigneeId = null;
                let priority = 'high';
                let categorySuffix = '';

                if (streak === 3) {
                    const cell = await get('SELECT leader_id FROM cells WHERE id = ?', [member.cell_id]);
                    assigneeId = cell?.leader_id;
                    title = `Visita de cercanía: ${member.first_name} ${member.last_name}`;
                    description = `${member.first_name} ha faltado a 3 reuniones consecutivas. Por favor, realiza una visita de cercanía para conocer su estado y motivarle.`;
                    categorySuffix = 'streak-3';
                } else if (streak === 4) {
                    const district = await get('SELECT supervisor_id FROM districts WHERE id = ?', [member.district_id]);
                    assigneeId = district?.supervisor_id;
                    title = `Visita de supervisor: ${member.first_name} ${member.last_name}`;
                    description = `${member.first_name} ha alcanzado 4 inasistencias consecutivas. Se requiere una visita de supervisión tras el seguimiento del líder de célula.`;
                    categorySuffix = 'streak-4';
                } else if (streak >= 5) {
                    const pastors = await query("SELECT id FROM profiles WHERE role IN ('Pastor', 'Pastor Asociado') LIMIT 1");
                    assigneeId = pastors[0]?.id;
                    title = `Atención Pastoral: ${member.first_name} ${member.last_name}`;
                    description = `ALERTA: ${member.first_name} tiene ${streak} inasistencias consecutivas. Requiere atención pastoral inmediata para evitar el abandono del proceso.`;
                    priority = 'urgent';
                    categorySuffix = 'streak-5';
                }

                if (assigneeId) {
                    const existingTask = await get(`
                        SELECT id FROM tasks 
                        WHERE related_member_id = ? 
                        AND category = ? 
                        AND status != 'cancelled'
                    `, [member.id, `automation-${categorySuffix}`]);

                    if (!existingTask) {
                        await run(`
                            INSERT INTO tasks (
                                id, title, description, status, priority, category, 
                                due_date, assigned_to_id, created_by_user_id, related_member_id, created_at
                            ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            uuidv4(), title, description, priority,
                            `automation-${categorySuffix}`, today, assigneeId,
                            'SYSTEM', member.id, new Date().toISOString()
                        ]);
                        console.log(`   [SUCCESS] Created ${title} for streak ${streak}`);
                        createdCount++;
                    } else {
                        console.log(`   [SKIP] Task already exists for level ${streak}`);
                    }
                }
            }
        }

        console.log(`\n--- Backfill Finished. Created ${createdCount} new tasks. ---`);
    } catch (err) {
        console.error('Backfill error:', err);
    }
}

backfill();
