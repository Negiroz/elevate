import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { run, get, query } from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads dir exists (sync is fine at startup/module load)
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function saveBase64Image(base64String) {
    try {
        const matches = base64String.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return null; // Invalid format
        }

        const ext = matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');
        const filename = `event-${Date.now()}-${uuidv4()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);

        fs.writeFileSync(filePath, buffer);
        return `/uploads/${filename}`;
    } catch (e) {
        console.error("Error saving image:", e);
        return null; // Return null on failure, or original string? Let's return null to fail gracefully or fallback
    }
}

const router = express.Router();
const SECRET = 'dev-secret-key-change-in-prod';

// Middleware to verify token
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// --- AUTH ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await get('SELECT * FROM profiles WHERE email = ?', [email]);
        if (!user) return res.status(400).json({ error: 'User not found' });

        // Maintenance Mode Check
        const maintenanceSetting = await get('SELECT value FROM system_settings WHERE key = ?', ['maintenance_mode']);
        const isMaintenanceMode = maintenanceSetting?.value === 'true';

        // Allow Admin, Pastor, Associate Pastor, District Supervisor
        const allowedRoles = ['Admin', 'Administrador', 'Pastor', 'Pastor Asociado', 'Supervisor de Distrito', 'admin', 'pastor', 'supervisor'];

        if (isMaintenanceMode && !allowedRoles.includes(user.role)) {
            return res.status(503).json({
                error: 'Sistema en Mantenimiento',
                message: '¡Hola! Estamos realizando mejoras para servirte mejor. El sistema está en mantenimiento temporalmente. Disculpa las molestias, estaremos de vuelta muy pronto.',
                maintenance: true
            });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '24h' });
        res.json({ session: { access_token: token, user: { id: user.id, email: user.email, role: user.role } } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SETTINGS (Admin Only) ---
router.get('/settings', auth, async (req, res) => {
    try {
        const settings = await query('SELECT * FROM system_settings');
        const config = {};
        settings.forEach(s => config[s.key] = s.value);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/settings', auth, async (req, res) => {
    try {
        const { key, value } = req.body;
        await run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, String(value)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/signup', async (req, res) => {
    let { email, password, data } = req.body;
    // Sanitize email
    if (email === '' || (typeof email === 'string' && email.trim() === '')) {
        return res.status(400).json({ error: 'Email is required for signup' });
    }
    try {
        const existing = await get('SELECT * FROM profiles WHERE email = ?', [email]);
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const id = uuidv4();
        const hash = await bcrypt.hash(password, 10);

        // Insert into profiles
        await run(`INSERT INTO profiles (id, email, password_hash, first_name, last_name, role, active, join_date, district_id, cell_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, email, hash, data.first_name, data.last_name, data.role || 'Miembro', 1, new Date().toISOString(), data.district_id, data.cell_id]);

        const token = jwt.sign({ id, email, role: data.role }, SECRET, { expiresIn: '24h' });
        res.json({ session: { access_token: token, user: { id, email, role: data.role } } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/profile/:id', auth, async (req, res) => {
    try {
        const user = await get('SELECT * FROM profiles WHERE id = ?', [req.params.id]);
        if (user) delete user.password_hash;
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to determine user access scope
const getAccessScope = async (userId, userRole) => {
    // Admins and Pastors see everything
    // Admins and Pastors see everything
    const normalizedRole = (userRole || '').toLowerCase();
    if (['administrador', 'pastor', 'admin'].includes(normalizedRole)) {
        return { scope: 'all' };
    }

    // Check if Supervisor
    const districts = await query('SELECT id FROM districts WHERE supervisor_id = ?', [userId]);
    if (districts.length > 0) {
        return {
            scope: 'supervisor',
            districtIds: districts.map(d => d.id)
        };
    }

    // Check if Leader (assigned as leader of a cell)
    const cells = await query('SELECT id FROM cells WHERE leader_id = ?', [userId]);
    if (cells.length > 0) {
        return {
            scope: 'leader',
            cellIds: cells.map(c => c.id)
        };
    }

    // Default: Regular member (sees nothing or own data usually, but here strict scope)
    return { scope: 'none' };
};

// --- PROFILES / MEMBERS ---
// --- DASHBOARD STATS ---
router.get('/stats/dashboard', auth, async (req, res) => {
    try {
        const access = await getAccessScope(req.user.id, req.user.role);

        // Base filters based on access scope
        let whereClause = '1=1';
        let params = [];

        if (access.scope === 'supervisor') {
            if (access.districtIds.length > 0) {
                const placeholders = access.districtIds.map(() => '?').join(',');
                whereClause += ` AND district_id IN (${placeholders})`;
                params.push(...access.districtIds);
            } else {
                whereClause += ' AND 1=0';
            }
        } else if (access.scope === 'leader') {
            if (access.cellIds.length > 0) {
                const placeholders = access.cellIds.map(() => '?').join(',');
                whereClause += ` AND cell_id IN (${placeholders})`;
                params.push(...access.cellIds);
            } else {
                whereClause += ' AND 1=0';
            }
        } else if (access.scope === 'none') {
            // Basic users only see themselves, effectively 0 stats for dashboard mostly
            whereClause += ' AND id = ?';
            params.push(req.user.id);
        }

        // Queries
        const activeCount = await get(`SELECT count(*) as count FROM profiles WHERE ${whereClause} AND active = 1`, params);
        const inactiveCount = await get(`SELECT count(*) as count FROM profiles WHERE ${whereClause} AND active = 0`, params);
        const totalCells = await get(`SELECT count(*) as count FROM cells WHERE 1=1`); // Simplified cells for now or filter by district if supervisor
        // Note: For cells, scope filtering logic is slightly different (leaders don't see all cells, supervisors see strict district cells)
        // Let's refine cell count if needed, but totalCells usually means "in my scope".

        let cellSql = 'SELECT count(*) as count FROM cells WHERE 1=1';
        let cellParams = [];
        if (access.scope === 'supervisor') {
            const placeholders = access.districtIds.map(() => '?').join(',');
            cellSql += ` AND district_id IN (${placeholders})`;
            cellParams.push(...access.districtIds);
        }
        const myCellsCount = await get(cellSql, cellParams);

        const timoteoCount = await get(`SELECT count(*) as count FROM profiles WHERE ${whereClause} AND role = 'Timoteo'`, params);

        // Cells with > 16 members (To multiply)
        // Complex query: Join profiles and count group by cell
        // SELECT count(*) FROM (SELECT cell_id, count(*) as c FROM profiles WHERE active=1 GROUP BY cell_id HAVING c > 16)
        // Applying scope...
        // Filter profiles by scope first? Yes.
        const cellsToMultiplyList = await query(`
            SELECT 
                cell_id as id,
                (SELECT name FROM cells WHERE id = profiles.cell_id) as name,
                (SELECT leader_id FROM cells WHERE id = profiles.cell_id) as leaderId,
                count(*) as activeMembers
            FROM profiles
            WHERE ${whereClause} AND active = 1 AND cell_id IS NOT NULL AND cell_id != ''
            GROUP BY cell_id
            HAVING SUM(CASE WHEN birth_date IS NOT NULL AND date(birth_date, '+18 years') <= date('now') THEN 1 ELSE 0 END) > 16
        `, params);

        // Pending Tasks
        // Tasks have their own scoping usually (assigned_to or related_member)
        // Simplified for this endpoint: Tasks assigned to ME or my scope
        // Let's rely on standard task fetching or simple count for current user
        const pendingTasks = await get(`SELECT count(*) as count FROM tasks WHERE assigned_to_id = ? AND status = 'pending'`, [req.user.id]);
        const overdueTasks = await get(`SELECT count(*) as count FROM tasks WHERE assigned_to_id = ? AND status = 'pending' AND due_date < date('now')`, [req.user.id]);

        // Church Age Average
        const ageStats = await get(`SELECT AVG((strftime('%Y', 'now') - strftime('%Y', birth_date))) as average FROM profiles WHERE ${whereClause} AND birth_date IS NOT NULL AND birth_date != ''`, params);

        // Age Distribution
        const ageDist = await query(`
            SELECT 
                CASE 
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 0 AND 9 THEN '0-9'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 10 AND 19 THEN '10-19'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 20 AND 29 THEN '20-29'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 30 AND 39 THEN '30-39'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 40 AND 49 THEN '40-49'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 50 AND 59 THEN '50-59'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 60 AND 69 THEN '60-69'
                    WHEN (strftime('%Y', 'now') - strftime('%Y', birth_date)) BETWEEN 70 AND 79 THEN '70-79'
                    ELSE '80+' 
                END as range,
                COUNT(*) as count
            FROM profiles
            WHERE ${whereClause} AND birth_date IS NOT NULL AND birth_date != ''
            GROUP BY range
        `, params);

        // Timoteos by Cell
        const timoteosByCellList = await query(`
            SELECT 
                (SELECT name FROM cells WHERE id = profiles.cell_id) as cellName,
                (SELECT first_name || ' ' || last_name FROM profiles p2 WHERE p2.id = (SELECT leader_id FROM cells WHERE id = profiles.cell_id)) as leaderName,
                count(*) as count
            FROM profiles
            WHERE ${whereClause} AND role = 'Timoteo' AND active = 1 AND cell_id IS NOT NULL
            GROUP BY cell_id
            ORDER BY count DESC
        `, params);

        // Gender Stats
        const genderData = await query(`
            SELECT gender, count(*) as count 
            FROM profiles 
            WHERE ${whereClause} AND active = 1 AND gender IS NOT NULL 
            GROUP BY gender
        `, params);

        const genderStats = [
            { name: 'Hombres', value: genderData.find(g => g.gender === 'Masculino')?.count || 0, color: '#3b82f6' },
            { name: 'Mujeres', value: genderData.find(g => g.gender === 'Femenino')?.count || 0, color: '#ec4899' }
        ];

        // District Stats (Members per District)
        // Group profiles by district to see distribution
        const districtData = await query(`
            SELECT 
                d.name as name, 
                d.color as color,
                count(p.id) as count 
            FROM profiles p
            LEFT JOIN districts d ON p.district_id = d.id
            WHERE ${whereClause} AND p.active = 1 AND p.district_id IS NOT NULL
            GROUP BY p.district_id
            ORDER BY count DESC
        `, params);

        res.json({
            activeCount: activeCount.count,
            inactiveCount: inactiveCount.count,
            totalCells: myCellsCount.count,
            cellsToMultiplyCount: cellsToMultiplyList.length,
            cellsToMultiplyList: cellsToMultiplyList,
            timoteoCount: timoteoCount.count,
            timoteosByCell: timoteosByCellList,
            genderStats: genderStats,
            districtStats: districtData.map(d => ({ name: d.name || 'Sin Distrito', value: d.count, color: d.color || '#ec4899' })),
            taskControl: {
                pending: pendingTasks.count,
                overdue: overdueTasks.count
            },
            churchAge: {
                average: Math.round(ageStats.average || 0),
                distribution: ageDist
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- PROFILES / MEMBERS ---
router.get('/profiles', auth, async (req, res) => {
    try {
        const access = await getAccessScope(req.user.id, req.user.role);
        const { page, limit, q, district, cell } = req.query;
        console.log('[DEBUG-PROFILES] Query Params:', { page, limit, q, district, cell });
        console.log('[DEBUG-PROFILES] Access Scope:', access);

        const isPagination = page !== undefined && limit !== undefined;
        const offset = isPagination ? (parseInt(page) - 1) * parseInt(limit) : 0;
        const limitVal = isPagination ? parseInt(limit) : -1;

        let whereClause = '1=1';
        let params = [];

        // Scope Filters
        if (access.scope === 'supervisor') {
            if (access.districtIds.length === 0) {
                whereClause += ' AND 1=0';
            } else {
                const placeholders = access.districtIds.map(() => '?').join(',');
                whereClause += ` AND p.district_id IN (${placeholders})`;
                params.push(...access.districtIds);
            }
        } else if (access.scope === 'leader') {
            if (access.cellIds.length === 0) {
                whereClause += ' AND 1=0';
            } else {
                const placeholders = access.cellIds.map(() => '?').join(',');
                whereClause += ` AND p.cell_id IN (${placeholders})`;
                params.push(...access.cellIds);
            }
        } else if (access.scope === 'none') {
            whereClause += ' AND p.id = ?';
            params.push(req.user.id);
        }

        // Optional User Filters (District/Cell)
        if (district && district !== 'Todos') {
            whereClause += ' AND p.district_id = ?';
            params.push(district);
        }

        if (cell && cell !== 'Todas') {
            whereClause += ' AND p.cell_id = ?';
            params.push(cell);
        }

        // Search Filter
        if (q) {
            whereClause += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ?)';
            const searchPattern = `%${q}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // Count Total (for pagination)
        let total = 0;
        if (isPagination) {
            const countRes = await get(`SELECT count(*) as count FROM profiles p WHERE ${whereClause}`, params);
            total = countRes.count;
        }
        console.log('[DEBUG-PROFILES] WhereClause:', whereClause);
        console.log('[DEBUG-PROFILES] Params:', params);

        let sql = `
            SELECT p.*
            FROM profiles p
            WHERE ${whereClause}
            ORDER BY first_name
        `;

        if (isPagination) {
            sql += ' LIMIT ? OFFSET ?';
            params.push(limitVal, offset);
        }

        const users = await query(sql, params);
        users.forEach(u => delete u.password_hash);

        if (isPagination) {
            res.json({
                data: users,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit))
                },
                debug: {
                    queryParams: req.query,
                    accessScope: access,
                    whereClause,
                    sqlParams: params
                }
            });
        } else {
            // Backward compatibility for non-paginated calls (like dropdowns)
            res.json(users);
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CONSOLIDATION STEPS HANDLING ---

const CONSOLIDATION_STEPS_TEMPLATE = [
    'Asignar distrito y célula',
    'Llamada y programación de cita',
    'Visita de vínculo',
    'Tema 1',
    'Tema 2',
    'Tema 3',
    'Tema 4',
    'Tema 5',
    'Tema 6',
    'Tema 7',
    'Asistir a célula',
    'Encuentro',
    'Bautizo'
];

router.get('/profiles/:id/steps', auth, async (req, res) => {
    try {
        const profileId = req.params.id;
        console.log(`[GET STEPS] Fetching steps for profile: ${profileId}`);

        let steps = await query('SELECT * FROM consolidation_steps WHERE profile_id = ? ORDER BY step_order', [profileId]);
        console.log(`[GET STEPS] Found ${steps.length} existing steps.`);

        // Self-healing: If no steps found, check if profile is a consolidation candidate and generate them
        if (steps.length === 0) {
            const profile = await get('SELECT consolidation_stage_id FROM profiles WHERE id = ?', [profileId]);
            console.log(`[GET STEPS] Profile found:`, profile);

            if (profile && profile.consolidation_stage_id) {
                console.log(`[GET STEPS] Auto-generating steps for ${profileId}`);
                for (let i = 0; i < CONSOLIDATION_STEPS_TEMPLATE.length; i++) {
                    const stepId = uuidv4();
                    await run('INSERT INTO consolidation_steps (id, profile_id, step_name, step_order) VALUES (?, ?, ?, ?)',
                        [stepId, profileId, CONSOLIDATION_STEPS_TEMPLATE[i], i]);
                }
                // Fetch again
                steps = await query('SELECT * FROM consolidation_steps WHERE profile_id = ? ORDER BY step_order', [profileId]);
                console.log(`[GET STEPS] Steps generated. Count: ${steps.length}`);
            } else {
                console.log(`[GET STEPS] Skipped generation. Stage ID: ${profile?.consolidation_stage_id}`);
            }
        }

        res.json(steps);
    } catch (err) {
        console.error('[GET STEPS] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/steps/:id', auth, async (req, res) => {
    try {
        const { completed } = req.body;
        const completed_at = completed ? new Date().toISOString() : null;
        await run('UPDATE consolidation_steps SET completed = ?, completed_at = ? WHERE id = ?',
            [completed ? 1 : 0, completed_at, req.params.id]);
        res.json({ success: true, completed_at });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile to auto-create steps
router.post('/profiles', auth, async (req, res) => {
    // Manual add using Insert
    try {
        const payload = { ...req.body };
        if (!payload.id) {
            payload.id = uuidv4();
        }

        // SANITIZE: Treat empty string email as null to avoid UNIQUE constraint violation
        if (payload.email === '' || (typeof payload.email === 'string' && payload.email.trim() === '')) {
            payload.email = null;
        }

        const cols = Object.keys(payload).join(', ');
        const placeholders = Object.keys(payload).map(() => '?').join(', ');
        const vals = Object.values(payload);

        await run(`INSERT INTO profiles (${cols}) VALUES (${placeholders})`, vals);

        // Auto-create steps if it's a consolidation profile
        if (payload.consolidation_stage_id) {
            // Determine max completed step based on stage position
            const stage = await get('SELECT position FROM consolidation_stages WHERE id = ?', [payload.consolidation_stage_id]);
            let maxCompletedOrder = -1;

            if (stage) {
                // Mapping Position -> Max Step Index (inclusive)
                // 6: Bautizados (All 12)
                // 5: Encuentristas (Up to Asistir a Célula - Index 10)
                // 4: En Célula (Up to Visita Vínculo - Index 2)
                // 3: En visitas (Up to Llamada - Index 1)
                // 2: Agendados (Up to Asignar - Index 0)
                const map = { 6: 12, 5: 11, 4: 2, 3: 1, 2: 0 };
                maxCompletedOrder = map[stage.position] ?? -1;
            }

            for (let i = 0; i < CONSOLIDATION_STEPS_TEMPLATE.length; i++) {
                const stepId = uuidv4();
                const isCompleted = i <= maxCompletedOrder;
                const completedAt = isCompleted ? new Date().toISOString() : null;

                await run('INSERT INTO consolidation_steps (id, profile_id, step_name, step_order, completed, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [stepId, payload.id, CONSOLIDATION_STEPS_TEMPLATE[i], i, isCompleted ? 1 : 0, completedAt]);
            }
        }

        res.json({ success: true, id: payload.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/profiles/:id', auth, async (req, res) => {
    try {
        const updates = req.body;
        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];

        await run(`UPDATE profiles SET ${cols} WHERE id = ?`, vals);

        // Auto-complete steps if stage changed
        if (updates.consolidation_stage_id) {
            const stage = await get('SELECT position FROM consolidation_stages WHERE id = ?', [updates.consolidation_stage_id]);
            if (stage) {
                // Mapping Position -> Max Step Index (Same as POST)
                const map = { 6: 12, 5: 11, 4: 2, 3: 1, 2: 0 };
                const maxCompletedOrder = map[stage.position] ?? -1;

                if (maxCompletedOrder >= 0) {
                    await run(
                        `UPDATE consolidation_steps 
                         SET completed = 1, completed_at = ? 
                         WHERE profile_id = ? AND step_order <= ? AND completed = 0`,
                        [new Date().toISOString(), req.params.id, maxCompletedOrder]
                    );
                }
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/profiles/:id', auth, async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`[DELETE] Request for ID: ${id}`);
        // Manual Cascade Delete
        await run('DELETE FROM cell_attendance WHERE member_id = ?', [id]);

        // Nullify creator for tasks they created (to preserve those tasks if for others)
        await run('UPDATE tasks SET created_by_user_id = NULL WHERE created_by_user_id = ?', [id]);

        await run('DELETE FROM tasks WHERE related_member_id = ? OR assigned_to_id = ?', [id, id]);
        // Also nullify leaderships if necessary or just let them be (for now simple cascade)
        await run('UPDATE cells SET leader_id = NULL WHERE leader_id = ?', [id]);
        await run('UPDATE districts SET supervisor_id = NULL WHERE supervisor_id = ?', [id]);

        // Delete steps
        await run('DELETE FROM consolidation_steps WHERE profile_id = ?', [id]);

        const result = await run('DELETE FROM profiles WHERE id = ?', [id]);
        console.log(`[DELETE] Profiles deleted: ${result.changes}`);
        res.json({ success: true, changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CELLS ---
router.get('/cells', auth, async (req, res) => {
    try {
        const access = await getAccessScope(req.user.id, req.user.role);
        let sql = 'SELECT * FROM cells WHERE 1=1';
        const params = [];

        if (access.scope === 'supervisor') {
            if (access.districtIds.length > 0) {
                const placeholders = access.districtIds.map(() => '?').join(',');
                sql += ` AND district_id IN (${placeholders})`;
                params.push(...access.districtIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'leader') {
            if (access.cellIds.length > 0) {
                const placeholders = access.cellIds.map(() => '?').join(',');
                sql += ` AND id IN (${placeholders})`;
                params.push(...access.cellIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'none') {
            sql += ' AND 1=0';
        }

        sql += ' ORDER BY name';

        const cells = await query(sql, params);
        // Get counts
        for (const cell of cells) {
            const row = await get('SELECT count(*) as count FROM profiles WHERE cell_id = ? AND active = 1', [cell.id]);
            cell.profiles = [{ count: row.count }];
        }
        res.json(cells);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CELLS ---
router.post('/cells', auth, async (req, res) => {
    try {
        const { name, leader_id, district_id, image_url, meeting_day } = req.body;
        const id = uuidv4();
        await run('INSERT INTO cells (id, name, leader_id, district_id, image_url, meeting_day) VALUES (?,?,?,?,?,?)',
            [id, name, leader_id, district_id, image_url, meeting_day]);

        // Sync leader's profile if assigned
        if (leader_id) {
            await run('UPDATE profiles SET cell_id = ?, district_id = ? WHERE id = ?', [id, district_id, leader_id]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/cells/:id', auth, async (req, res) => {
    try {
        const updates = req.body;
        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];
        await run(`UPDATE cells SET ${cols} WHERE id = ?`, vals);

        // Sync leader's profile if leader_id is involved in updates
        if (updates.leader_id) {
            // We might need the district_id too. If it's in updates, use it. If not, fetch it from the cell.
            let districtId = updates.district_id;
            if (!districtId) {
                const cell = await get('SELECT district_id FROM cells WHERE id = ?', [req.params.id]);
                districtId = cell?.district_id;
            }

            if (districtId) {
                await run('UPDATE profiles SET cell_id = ?, district_id = ? WHERE id = ?',
                    [req.params.id, districtId, updates.leader_id]);
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/cells/:id', auth, async (req, res) => {
    try {
        await run('DELETE FROM cells WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DISTRICTS ---
router.get('/districts', auth, async (req, res) => {
    try {
        const districts = await query('SELECT * FROM districts ORDER BY name');
        for (const d of districts) {
            const row = await get('SELECT count(*) as count FROM cells WHERE district_id = ?', [d.id]);
            d.cells = [{ count: row.count }];
        }
        res.json(districts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/districts', auth, async (req, res) => {
    try {
        const { name, supervisor_id, active, color } = req.body;
        const id = uuidv4();
        await run('INSERT INTO districts (id, name, supervisor_id, active, color) VALUES (?, ?, ?, ?, ?)',
            [id, name, supervisor_id, active, color]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/districts/:id', auth, async (req, res) => {
    try {
        const updates = req.body;
        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];
        await run(`UPDATE districts SET ${cols} WHERE id = ?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/districts/:id', auth, async (req, res) => {
    try {
        await run('DELETE FROM districts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TASKS ---
router.get('/tasks', auth, async (req, res) => {
    try {
        const { related_member_id, status } = req.query;
        let sql = 'SELECT * FROM tasks WHERE 1=1';
        const params = [];

        if (related_member_id) {
            sql += ' AND related_member_id = ?';
            params.push(related_member_id);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY due_date ASC';
        const tasks = await query(sql, params);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tasks', auth, async (req, res) => {
    try {
        const task = req.body;
        const id = uuidv4();
        // Helper to map object to insert
        const keys = ['id', ...Object.keys(task)];
        const vals = [id, ...Object.values(task)];
        const placeholders = keys.map(() => '?').join(',');

        await run(`INSERT INTO tasks (${keys.join(',')}) VALUES (${placeholders})`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/tasks/:id', auth, async (req, res) => {
    try {
        const updates = req.body;
        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];
        await run(`UPDATE tasks SET ${cols} WHERE id = ?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/tasks/:id', auth, async (req, res) => {
    try {
        await run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CONSOLIDATION STAGES ---
router.get('/consolidation_stages', auth, async (req, res) => {
    try {
        const stages = await query('SELECT * FROM consolidation_stages ORDER BY position');
        res.json(stages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/consolidation_stages', auth, async (req, res) => {
    try {
        const { title, color, position } = req.body;
        const id = uuidv4();
        await run('INSERT INTO consolidation_stages (id, title, color, position) VALUES (?, ?, ?, ?)',
            [id, title, color, position]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/consolidation_stages/:id', auth, async (req, res) => {
    try {
        const updates = req.body;
        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];
        await run(`UPDATE consolidation_stages SET ${cols} WHERE id = ?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/consolidation_stages/:id', auth, async (req, res) => {
    try {
        await run('DELETE FROM consolidation_stages WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- STATS HELPER ---
router.get('/stats/active-count', auth, async (req, res) => {
    try {
        const { district_id } = req.query;
        // RBAC Scope
        const access = await getAccessScope(req.user.id, req.user.role);
        console.log(`[DEBUG active-count] district_id: ${district_id}, scope: ${access.scope}`);

        let sql = 'SELECT count(*) as count FROM profiles p WHERE p.active = 1';
        const params = [];

        // Apply Scope Filters
        if (access.scope === 'supervisor') {
            if (access.districtIds.length > 0) {
                const placeholders = access.districtIds.map(() => '?').join(',');
                sql += ` AND p.district_id IN (${placeholders})`;
                params.push(...access.districtIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'leader') {
            if (access.cellIds.length > 0) {
                const placeholders = access.cellIds.map(() => '?').join(',');
                sql += ` AND p.cell_id IN (${placeholders})`;
                params.push(...access.cellIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'none') {
            // Regular user sees nothing or just themselves? 
            // Logic in dashboard stats uses active=1 AND id=userID. Let's do same.
            sql += ' AND p.id = ?';
            params.push(req.user.id);
        }

        // Apply Query Filters (e.g. from Dashboard dropdown)
        // Note: Dropdown 'district_id' should respect scope. 
        // If supervisor selects "Todos", they see "All THEIR districts".
        // The code above handles the base scope.
        // If specific district selected:
        if (district_id && district_id !== 'Todos') {
            // Must ensure this district is allowed if supervisor
            // Simple approach: Add AND p.district_id = ?
            // If scope restricted 'IN (1,2)', appending 'AND district_id=3' will yield 0, which is correct (not allowed).

            // Join cells? No, profiles have district_id directly usually.
            // Wait, the original code joined cells:
            // INNER JOIN cells ON profiles.cell_id = cells.id 

            // Let's keep it safe:
            // But simpler: profiles has district_id.
            sql += ` AND p.district_id = ?`;
            params.push(district_id);
        }

        const result = await query(sql, params);
        res.json({ count: result[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- ATTENDANCE ---
router.get('/attendance', auth, async (req, res) => {
    try {
        const { from, date, type, cell_id } = req.query;
        // DEBUG
        if (req.query.district_id) console.log(`[DEBUG attendance] filtering by district: ${req.query.district_id}`);

        let sql = 'SELECT * FROM cell_attendance WHERE 1=1';
        const params = [];

        // RBAC Logic
        const access = await getAccessScope(req.user.id, req.user.role);
        if (access.scope === 'supervisor') {
            // Filter attendance by cells in supervisor's districts
            // Subquery is cleaner here than two trips if supported, but simple IN clause with pre-fetched IDs is fine
            // We need cell IDs belonging to the district.
            // Let's do a JOIN logic or fetch allowed cells first.
            // Easier: filter by cell_id in (...)
            const allowedCells = await query(`SELECT id FROM cells WHERE district_id IN (${access.districtIds.map(() => '?').join(',')})`, access.districtIds);
            const allowedCellIds = allowedCells.map(c => c.id);

            if (allowedCellIds.length > 0) {
                sql += ` AND cell_id IN (${allowedCellIds.map(() => '?').join(',')})`;
                params.push(...allowedCellIds);
            } else {
                sql += ' AND 1=0';
            }

        } else if (access.scope === 'leader') {
            if (access.cellIds.length > 0) {
                sql += ` AND cell_id IN (${access.cellIds.map(() => '?').join(',')})`;
                params.push(...access.cellIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'none') {
            sql += ' AND 1=0';
        }

        if (from) {
            sql += ' AND date >= ?';
            params.push(from);
        }
        if (date) {
            sql += ' AND date = ?';
            params.push(date);
        }
        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }
        if (cell_id) {
            // Ensure queried cell_id is within allowed scope if strict
            sql += ' AND cell_id = ?';
            params.push(cell_id);
        }
        if (req.query.status) {
            sql += ' AND status = ?';
            params.push(req.query.status);
        }
        if (req.query.member_id) {
            sql += ' AND member_id = ?';
            params.push(req.query.member_id);
        }
        if (req.query.event_id) {
            sql += ' AND event_id = ?';
            params.push(req.query.event_id);
        }

        // Filter by District
        if (req.query.district_id && req.query.district_id !== 'Todos') {
            const cellsInDistrict = await query('SELECT id FROM cells WHERE district_id = ?', [req.query.district_id]);
            const cellIds = cellsInDistrict.map(c => c.id);
            if (cellIds.length > 0) {
                sql += ` AND cell_id IN (${cellIds.map(() => '?').join(',')})`;
                params.push(...cellIds);
            } else {
                sql += ' AND 1=0'; // No cells in district, no attendance
            }
        }

        sql += ' ORDER BY date DESC';

        const records = await query(sql, params);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/attendance', auth, async (req, res) => {
    try {
        let items = [];
        let offering = null;

        // Support Legacy Array or New Object structure
        if (Array.isArray(req.body)) {
            items = req.body;
        } else if (req.body.attendanceRecords) {
            items = req.body.attendanceRecords;
            offering = req.body.offering;
        } else {
            items = [req.body];
        }

        for (const item of items) {
            // Check for existing
            const existing = await get(
                'SELECT id FROM cell_attendance WHERE member_id = ? AND date = ? AND type = ?',
                [item.member_id, item.date, item.type]
            );

            if (existing) {
                // Fix: Update status and type/cell_id if needed
                await run('UPDATE cell_attendance SET status = ?, cell_id = ? WHERE id = ?',
                    [item.status, item.cell_id, existing.id]);
            } else {
                const id = uuidv4();
                await run(
                    'INSERT INTO cell_attendance (id, cell_id, member_id, date, status, type, event_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, item.cell_id, item.member_id, item.date, item.status, item.type, item.event_id || null]
                );
            }
        }

        // Process Offering Report if present
        if (offering) {
            const existingReport = await get('SELECT id FROM offering_reports WHERE cell_id = ? AND date = ?', [offering.cell_id, offering.date]);
            if (existingReport) {
                await run('UPDATE offering_reports SET cash_bs = ?, cash_usd = ?, transfer = ? WHERE id = ?',
                    [offering.cash_bs || 0, offering.cash_usd || 0, offering.transfer || 0, existingReport.id]);
            } else {
                await run('INSERT INTO offering_reports (id, cell_id, date, cash_bs, cash_usd, transfer) VALUES (?, ?, ?, ?, ?, ?)',
                    [uuidv4(), offering.cell_id, offering.date, offering.cash_bs || 0, offering.cash_usd || 0, offering.transfer || 0]);
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/offerings', auth, async (req, res) => {
    try {
        const sql = `
            SELECT r.*, c.name as cell_name, d.name as district_name 
            FROM offering_reports r
            LEFT JOIN cells c ON r.cell_id = c.id
            LEFT JOIN districts d ON c.district_id = d.id
            ORDER BY r.date DESC
        `;
        const reports = await query(sql);
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/offering/detail', auth, async (req, res) => {
    try {
        const { cell_id, date } = req.query;
        if (!cell_id || !date) {
            return res.status(400).json({ error: 'cell_id and date are required' });
        }
        const report = await get('SELECT * FROM offering_reports WHERE cell_id = ? AND date = ?', [cell_id, date]);
        res.json(report || null);
    } catch (err) {
        console.error('Error fetching offering detail:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/attendance/delete', auth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "ids must be array" });

        const placeholders = ids.map(() => '?').join(',');
        await run(`DELETE FROM cell_attendance WHERE id IN (${placeholders})`, ids);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- EVENTS ---
router.get('/events', auth, async (req, res) => {
    try {
        const events = await query('SELECT * FROM events ORDER BY date DESC');

        // Calculate stats for each event
        for (const event of events) {
            // Attendance count
            const att = await get('SELECT count(*) as count FROM cell_attendance WHERE event_id = ? AND status = "present"', [event.id]);
            event.attendance_count = att.count;

            // Conversions count
            const conv = await get('SELECT count(*) as count FROM profiles WHERE conversion_event_id = ?', [event.id]);
            event.conversion_count = conv.count;

            // Retention count (Active converted members)
            // Fix: Check for 'active != 0' which is broader than 'active = 1' and safer in SQLite for truthy
            const retention = await get(`
                SELECT count(*) as count 
                FROM profiles 
                WHERE conversion_event_id = ? 
                AND active != 0 
                AND active IS NOT NULL
            `, [event.id]);
            event.retention_count = retention.count;

            console.log(`[Event Stats] ${event.name} (${event.id}): Conv=${event.conversion_count} Ret=${event.retention_count}`);
        }

        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/events/:id/report', auth, async (req, res) => {
    try {
        const eventId = req.params.id;
        const districts = await query('SELECT id, name FROM districts ORDER BY name');

        const report = [];

        for (const district of districts) {
            // 1. Active Members in District
            // Assuming district_id is on profiles
            const activeMembersRow = await get(`
                SELECT count(*) as count 
                FROM profiles 
                WHERE district_id = ? AND active != 0
            `, [district.id]);

            // 2. Attendance Count for this Event from this District
            // We join cell_attendance -> cells -> district_id check
            // Or simpler: cell_attendance -> member_id -> profile -> district_id (more robust if member moved, but cell snapshot is better)
            // Actually, attendance is linked to a cell. Cell belongs to a district.
            // Let's use the cell's current district linkage.
            const attendanceRow = await get(`
                SELECT count(*) as count 
                FROM cell_attendance ca
                JOIN cells c ON ca.cell_id = c.id
                WHERE ca.event_id = ? 
                AND c.district_id = ? 
                AND ca.status = 'present'
            `, [eventId, district.id]);

            // 3. Conversions Assigned to this District
            // Conversions are profiles with conversion_event_id set. 
            // They are assigned to a district via profile.district_id
            const conversionsRow = await get(`
                SELECT count(*) as count 
                FROM profiles 
                WHERE conversion_event_id = ? 
                AND district_id = ?
            `, [eventId, district.id]);

            const active = activeMembersRow.count;
            const attendance = attendanceRow.count;
            const conversions = conversionsRow.count;
            // Percentage: Attendance / Active (Cap at 100%? No, could be >100 if visitors)
            const percentage = active > 0 ? Math.round((attendance / active) * 100) : 0;
            const total = attendance + conversions;

            report.push({
                districtId: district.id,
                districtName: district.name,
                activeMembers: active,
                attendance: attendance,
                percentage: percentage,
                conversions: conversions,
                total: total
            });
        }

        // Add 'Sin Distrito' or 'General' bucket if needed? 
        // For now, let's stick to strict districts.

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/events', auth, async (req, res) => {
    try {
        let { name, description, date, image_url, active } = req.body;

        // Handle Image Upload
        if (image_url && image_url.startsWith('data:image')) {
            const savedUrl = saveBase64Image(image_url);
            if (savedUrl) image_url = savedUrl;
        }

        const id = uuidv4();
        await run('INSERT INTO events (id, name, description, date, image_url, active) VALUES (?, ?, ?, ?, ?, ?)',
            [id, name, description, date, image_url, active]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/events/:id', auth, async (req, res) => {
    try {
        const updates = req.body;

        // Handle Image Update
        if (updates.image_url && updates.image_url.startsWith('data:image')) {
            const savedUrl = saveBase64Image(updates.image_url);
            if (savedUrl) updates.image_url = savedUrl;
        }

        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];
        await run(`UPDATE events SET ${cols} WHERE id = ?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/events/:id', auth, async (req, res) => {
    try {
        // Cascade nullify (or delete? kept nullify for history)
        await run('UPDATE cell_attendance SET event_id = NULL WHERE event_id = ?', [req.params.id]);
        await run('UPDATE profiles SET conversion_event_id = NULL WHERE conversion_event_id = ?', [req.params.id]);

        await run('DELETE FROM events WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- AUDIT ---
router.get('/audit', auth, async (req, res) => {
    try {
        const issues = {
            usersWithoutCell: [],
            usersWithoutLeader: [],
            cellsWithoutLeader: [],
            incompleteProfiles: []
        };

        // 1. Active Users without Cell (Standard Members ONLY)
        // Managers (Pastors, Admins, Supervisors) often don't have a cell, so we exclude them to reduce noise.
        // We only audit: 'Miembro', 'Líder', 'Visitante', 'Nuevo'
        // 1. Active Users without Cell (Standard Members ONLY)
        issues.usersWithoutCell = await query(`
            SELECT p.id, p.first_name, p.last_name, p.role, d.name as district_name
            FROM profiles p
            LEFT JOIN districts d ON p.district_id = d.id
            WHERE p.active = 1 
            AND p.role NOT IN('admin', 'pastor', 'supervisor', 'Administrador', 'Pastor', 'Supervisor de Distrito')
            AND(p.cell_id IS NULL OR p.cell_id = '')
                `);
        console.log(`[AUDIT] Users without cell: ${issues.usersWithoutCell.length}`);

        // 2. Active Users without Leader (Users in a cell, but cell has no leader)
        issues.usersWithoutLeader = await query(`
            SELECT p.id, p.first_name, p.last_name, p.role, c.name as cell_name, d.name as district_name
            FROM profiles p
            LEFT JOIN cells c ON p.cell_id = c.id
            LEFT JOIN districts d ON p.district_id = d.id
            WHERE p.active = 1 
            AND p.role NOT IN('admin', 'pastor', 'Administrador', 'Pastor')
            AND p.cell_id IS NOT NULL AND p.cell_id != ''
            AND p.cell_id IN(SELECT id FROM cells WHERE leader_id IS NULL OR leader_id = '')
            `);
        console.log(`[AUDIT] Users without leader: ${issues.usersWithoutLeader.length}`);

        // 3. Cells without Leader
        issues.cellsWithoutLeader = await query(`
            SELECT c.id, c.name, d.name as district_name
            FROM cells c
            LEFT JOIN districts d ON c.district_id = d.id
            WHERE(c.leader_id IS NULL OR c.leader_id = '')
                `);

        // 4. Incomplete Profiles (missing phone or address)
        issues.incompleteProfiles = await query(`
            SELECT p.id, p.first_name, p.last_name, p.phone, p.address, c.name as cell_name, d.name as district_name
            FROM profiles p
            LEFT JOIN cells c ON p.cell_id = c.id
            LEFT JOIN districts d ON p.district_id = d.id
            WHERE p.active = 1 AND(p.phone IS NULL OR p.phone = '' OR p.address IS NULL OR p.address = '')
            `);

        res.json(issues);
    } catch (err) {
        console.error('Audit error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ANNOUNCEMENTS ---
router.get('/announcements', auth, async (req, res) => {
    try {
        const { active_only } = req.query;
        let sql = 'SELECT * FROM announcements WHERE 1=1';
        const params = [];

        if (active_only === 'true') {
            sql += ' AND active = 1';
        }

        sql += ' ORDER BY created_at DESC';
        const announcements = await query(sql, params);
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/announcements', auth, async (req, res) => {
    try {
        let { title, message, image_url, active } = req.body;

        // Handle Image Upload
        if (image_url && image_url.startsWith('data:image')) {
            const savedUrl = saveBase64Image(image_url);
            if (savedUrl) image_url = savedUrl;
        }

        const id = uuidv4();
        await run('INSERT INTO announcements (id, title, message, image_url, active, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)',
            [id, title, message, image_url, active ? 1 : 0, req.user.id]);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/announcements/:id', auth, async (req, res) => {
    try {
        const updates = req.body;

        // Handle Image Update
        if (updates.image_url && updates.image_url.startsWith('data:image')) {
            const savedUrl = saveBase64Image(updates.image_url);
            if (savedUrl) updates.image_url = savedUrl;
        }

        const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(updates), req.params.id];
        await run(`UPDATE announcements SET ${cols} WHERE id = ?`, vals);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/announcements/:id', auth, async (req, res) => {
    try {
        await run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
