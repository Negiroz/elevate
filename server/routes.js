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

        if (!user.password_hash) return res.status(400).json({ error: 'Invalid password (no hash)' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '24h' });
        res.json({ session: { access_token: token, user: { id: user.id, email: user.email, role: user.role } } });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
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

        // 1. COMBINED AGGREGATED COUNTS (Scalar values) to reduce round-trips
        // We use subqueries to get all simple counts in one go
        const combinedCounts = await get(`
            SELECT 
                (SELECT count(*) FROM profiles WHERE ${whereClause} AND active = 1) as activeCount,
                (SELECT count(*) FROM profiles WHERE ${whereClause} AND active = 0) as inactiveCount,
                (SELECT count(*) FROM profiles WHERE ${whereClause} AND role = 'Timoteo') as timoteoCount
        `, params);

        // Cell Count (My Scope)
        let cellSql = 'SELECT count(*) as count FROM cells WHERE 1=1';
        let cellParams = [];
        if (access.scope === 'supervisor') {
            const placeholders = access.districtIds.map(() => '?').join(',');
            cellSql += ` AND district_id IN (${placeholders})`;
            cellParams.push(...access.districtIds);
        } else if (access.scope === 'leader') {
            // For cell count in dashboard, usually we show total cells under my purview. 
            // If leader, it's just 1 (their cell) or 0.
            const placeholders = access.cellIds.map(() => '?').join(',');
            if (access.cellIds.length > 0) {
                cellSql += ` AND id IN (${placeholders})`;
                cellParams.push(...access.cellIds);
            } else {
                cellSql += ' AND 1=0';
            }
        }

        // 2. PARALLEL EXECUTION OF HEAVY/INDEPENDENT QUERIES
        const [
            myCellsCount,
            cellsToMultiplyList,
            taskCounts,
            ageStats,
            ageDist,
            timoteosByCellList,
            genderData,
            districtData
        ] = await Promise.all([
            get(cellSql, cellParams), // 1. Cell Count

            // 2. Cells to Multiply List (Optimized)
            // Uses efficient date comparison instead of string manipulation
            query(`
                SELECT 
                    cell_id as id,
                    (SELECT name FROM cells WHERE id = profiles.cell_id) as name,
                    (SELECT leader_id FROM cells WHERE id = profiles.cell_id) as leaderId,
                    count(*) as activeMembers
                FROM profiles
                WHERE ${whereClause} AND active = 1 AND cell_id IS NOT NULL AND cell_id != ''
                GROUP BY cell_id
                HAVING SUM(CASE WHEN birth_date IS NOT NULL AND birth_date <= date('now', '-18 years') THEN 1 ELSE 0 END) > 16
            `, params),

            // 3. Task Counts (Pending & Overdue)
            get(`
                SELECT 
                    (SELECT count(*) FROM tasks WHERE assigned_to_id = ? AND status = 'pending') as pending,
                    (SELECT count(*) FROM tasks WHERE assigned_to_id = ? AND status = 'pending' AND due_date < date('now')) as overdue
            `, [req.user.id, req.user.id]),

            // 4. Age Average
            get(`SELECT AVG((strftime('%Y', 'now') - strftime('%Y', birth_date))) as average FROM profiles WHERE ${whereClause} AND birth_date IS NOT NULL AND birth_date != ''`, params),

            // 5. Age Distribution (Optimized)
            // Uses simple CASE WHEN on date ranges which hits the index better than computing age for every row
            query(`
                SELECT 
                    CASE 
                        WHEN birth_date > date('now', '-10 years') THEN '0-9'
                        WHEN birth_date <= date('now', '-10 years') AND birth_date > date('now', '-20 years') THEN '10-19'
                        WHEN birth_date <= date('now', '-20 years') AND birth_date > date('now', '-30 years') THEN '20-29'
                        WHEN birth_date <= date('now', '-30 years') AND birth_date > date('now', '-40 years') THEN '30-39'
                        WHEN birth_date <= date('now', '-40 years') AND birth_date > date('now', '-50 years') THEN '40-49'
                        WHEN birth_date <= date('now', '-50 years') AND birth_date > date('now', '-60 years') THEN '50-59'
                        WHEN birth_date <= date('now', '-60 years') AND birth_date > date('now', '-70 years') THEN '60-69'
                        WHEN birth_date <= date('now', '-70 years') AND birth_date > date('now', '-80 years') THEN '70-79'
                        ELSE '80+' 
                    END as range,
                    COUNT(*) as count
                FROM profiles
                WHERE ${whereClause} AND birth_date IS NOT NULL AND birth_date != ''
                GROUP BY range
            `, params),

            // 6. Timoteos By Cell
            query(`
                SELECT 
                    (SELECT name FROM cells WHERE id = profiles.cell_id) as cellName,
                    (SELECT first_name || ' ' || last_name FROM profiles p2 WHERE p2.id = (SELECT leader_id FROM cells WHERE id = profiles.cell_id)) as leaderName,
                    count(*) as count
                FROM profiles
                WHERE ${whereClause} AND role = 'Timoteo' AND active = 1 AND cell_id IS NOT NULL
                GROUP BY cell_id
                ORDER BY count DESC
            `, params),

            // 7. Gender Stats
            query(`
                SELECT gender, count(*) as count 
                FROM profiles 
                WHERE ${whereClause} AND active = 1 AND gender IS NOT NULL 
                GROUP BY gender
            `, params),

            // 8. District Stats
            query(`
                SELECT 
                    d.name as name, 
                    d.color as color,
                    count(p.id) as count 
                FROM profiles p
                LEFT JOIN districts d ON p.district_id = d.id
                WHERE ${whereClause} AND p.active = 1 AND p.district_id IS NOT NULL
                GROUP BY p.district_id
                ORDER BY count DESC
            `, params)
        ]);

        const genderStats = [
            { name: 'Hombres', value: genderData.find(g => g.gender === 'Masculino')?.count || 0, color: '#3b82f6' },
            { name: 'Mujeres', value: genderData.find(g => g.gender === 'Femenino')?.count || 0, color: '#ec4899' }
        ];

        res.json({
            activeCount: combinedCounts.activeCount,
            inactiveCount: combinedCounts.inactiveCount,
            totalCells: myCellsCount.count,
            cellsToMultiplyCount: cellsToMultiplyList.length,
            cellsToMultiplyList: cellsToMultiplyList,
            timoteoCount: combinedCounts.timoteoCount,
            timoteosByCell: timoteosByCellList,
            genderStats: genderStats,
            districtStats: districtData.map(d => ({ name: d.name || 'Sin Distrito', value: d.count, color: d.color || '#ec4899' })),
            taskControl: {
                pending: taskCounts.pending,
                overdue: taskCounts.overdue
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
        const { page, limit, q, district, cell, include_stats, consolidation_only } = req.query;
        // console.log('[DEBUG-PROFILES] Query Params:', { page, limit, q, district, cell });

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

        // Consolidation Filter (Server-side optimization)
        if (consolidation_only === 'true') {
            whereClause += ' AND p.consolidation_stage_id IS NOT NULL AND p.consolidation_stage_id != ""';
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

        // Optimized Query with JOINs for Stats instead of subqueries or loops
        // This brings everything in one go.
        let sql = `
            SELECT p.*,
                COUNT(s.id) as total_steps,
                SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completed_steps
            FROM profiles p
            LEFT JOIN consolidation_steps s ON p.id = s.profile_id
            WHERE ${whereClause}
            GROUP BY p.id
            ORDER BY p.first_name
        `;

        if (isPagination) {
            sql += ' LIMIT ? OFFSET ?';
            params.push(limitVal, offset);
        }

        const users = await query(sql, params);
        users.forEach(u => delete u.password_hash);

        // Fix 0 steps: If in consolidation but no steps found (JOIN returned 0), 
        // we assume template length (13) for UI consistency without writing DB.
        users.forEach(u => {
            // ensure numbers
            u.total_steps = u.total_steps || 0;
            u.completed_steps = u.completed_steps || 0;

            if (u.consolidation_stage_id && u.active && u.total_steps === 0) {
                u.total_steps = 13;
                u.completed_steps = 0;
            }
        });

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
                    whereClause
                }
            });
        } else {
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
    'Tema 8',
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
        res.set('Cache-Control', 'no-store');
        const access = await getAccessScope(req.user.id, req.user.role);
        let sql = `
            SELECT c.*, 
                   p.first_name as leader_first_name, 
                   p.last_name as leader_last_name,
                   (SELECT COUNT(*) FROM profiles WHERE cell_id = c.id AND active = 1) as member_count
            FROM cells c
            LEFT JOIN profiles p ON c.leader_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (access.scope === 'supervisor') {
            if (access.districtIds.length > 0) {
                const placeholders = access.districtIds.map(() => '?').join(',');
                sql += ` AND c.district_id IN (${placeholders})`;
                params.push(...access.districtIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'leader') {
            if (access.cellIds.length > 0) {
                const placeholders = access.cellIds.map(() => '?').join(',');
                sql += ` AND c.id IN (${placeholders})`;
                params.push(...access.cellIds);
            } else {
                sql += ' AND 1=0';
            }
        } else if (access.scope === 'none') {
            sql += ' AND 1=0';
        }

        sql += ' ORDER BY c.name';

        const cells = await query(sql, params);
        res.json(cells);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CELLS ---
router.post('/cells', auth, async (req, res) => {
    try {
        const { name, leader_id, district_id, image_url, meeting_day } = req.body;
        const id = req.body.id || uuidv4();
        await run('INSERT INTO cells (id, name, leader_id, district_id, image_url, meeting_day) VALUES (?,?,?,?,?,?)',
            [id, name, leader_id, district_id, image_url, meeting_day]);

        // Sync leader's profile if assigned
        if (leader_id) {
            await run('UPDATE profiles SET cell_id = ?, district_id = ? WHERE id = ?', [id, district_id, leader_id]);
        }

        res.json({ success: true, id });
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
        res.set('Cache-Control', 'no-store');
        const districts = await query(`
            SELECT d.*, p.first_name as supervisor_first_name, p.last_name as supervisor_last_name 
            FROM districts d
            LEFT JOIN profiles p ON d.supervisor_id = p.id
            ORDER BY d.name
        `);
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
        const id = req.body.id || uuidv4();
        await run('INSERT INTO districts (id, name, supervisor_id, active, color) VALUES (?, ?, ?, ?, ?)',
            [id, name, supervisor_id, active, color]);
        res.json({ success: true, id });
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

// --- AUTOMATIONS ---
router.post('/tasks/automations/run', auth, async (req, res) => {
    try {
        console.log('[AUTOMATION] Running daily birthday check...');

        // 1. Get today's date string (YYYY-MM-DD) for due_date
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayCommonStr = `${today.getFullYear()}-${mm}-${dd}`; // YYYY-MM-DD for current year

        // 2. Find active users with birthday today
        // Note: SQLite strftime('%m', birth_date) returns month, etc.
        const todayBirthdays = await query(`
            SELECT * FROM profiles 
            WHERE active = 1 
            AND birth_date IS NOT NULL 
            AND strftime('%m', birth_date) = ? 
            AND strftime('%d', birth_date) = ?
        `, [mm, dd]);

        console.log(`[AUTOMATION] Found ${todayBirthdays.length} birthdays today.`);

        if (todayBirthdays.length === 0) {
            return res.json({ success: true, message: 'No birthdays today', createdCount: 0 });
        }

        // 3. Prepare roles and helpers
        const cells = await query('SELECT id, leader_id FROM cells');
        const districts = await query('SELECT id, name, supervisor_id FROM districts');
        const pastors = await query("SELECT id FROM profiles WHERE role IN ('Pastor', 'Pastor Asociado')");

        const cellsMap = new Map(cells.map(c => [c.id, c.leader_id]));
        const districtsMap = new Map(districts.map(d => [d.id, d.supervisor_id]));
        const districtNamesMap = new Map(districts.map(d => [d.id, d.name]));
        const pastorIds = pastors.map(p => p.id);

        let createdCount = 0;

        // 4. Iterate and create tasks idempotently
        for (const person of todayBirthdays) {
            const assignees = new Set();

            // Add Cell Leader
            if (person.cell_id && cellsMap.has(person.cell_id)) {
                const leaderId = cellsMap.get(person.cell_id);
                if (leaderId) assignees.add(leaderId);
            }

            // Add District Supervisor
            if (person.district_id && districtsMap.has(person.district_id)) {
                const supervisorId = districtsMap.get(person.district_id);
                if (supervisorId) assignees.add(supervisorId);
            }

            // Add Pastors
            pastorIds.forEach(id => assignees.add(id));

            // Remove self
            assignees.delete(person.id);

            const districtName = person.district_id ? (districtNamesMap.get(person.district_id) || 'Sin Distrito') : 'Sin Distrito';
            const userRole = person.role || 'Miembro';

            const title = `Cumpleaños: ${person.first_name} ${person.last_name} (${userRole})`;
            const description = `Hoy es el cumpleaños de ${person.first_name} ${person.last_name}.\n\nRol: ${userRole}\nDistrito: ${districtName}\nTeléfono: ${person.phone || 'No registrado'}\n\n¡Llama para felicitarle!`;

            for (const assigneeId of assignees) {
                // IDEMPOTENCY: Reliance on UNIQUE INDEX (category, related_member_id, assigned_to_id, due_date)
                // We use INSERT OR IGNORE to prevent duplicates without race conditions.

                const taskId = uuidv4();
                try {
                    const result = await run(`
                        INSERT OR IGNORE INTO tasks (
                            id, title, description, status, priority, category, 
                            due_date, assigned_to_id, created_by_user_id, related_member_id, created_at
                        ) VALUES (?, ?, ?, 'pending', 'high', 'automation', ?, ?, ?, ?, ?)
                    `, [
                        taskId, title, description, todayCommonStr,
                        assigneeId, req.user.id, person.id, new Date().toISOString()
                    ]);

                    if (result.changes > 0) {
                        createdCount++;
                    }
                } catch (e) {
                    // Fallback logging if something strictly fails not related to constraint (rare with OR IGNORE)
                    console.error('[AUTOMATION] Error inserting task:', e);
                }
            }
        }

        console.log(`[AUTOMATION] Created ${createdCount} new birthday tasks.`);
        res.json({ success: true, createdCount });

    } catch (err) {
        console.error('[AUTOMATION] Error:', err);
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

        // --- ATTENDANCE TASK AUTOMATION ---
        // Trigger logic for consecutive absences
        for (const item of items) {
            if (item.status === 'absent') {
                try {
                    // 1. Get last 6 attendance records (including the one just inserted/updated)
                    // We order by date DESC, then created_at DESC to handle same-day entries in tests
                    const history = await query(`
                        SELECT status, date FROM cell_attendance 
                        WHERE member_id = ? 
                        ORDER BY date DESC, created_at DESC
                        LIMIT 6
                    `, [item.member_id]);

                    // 2. Count consecutive absences
                    let consecutiveAbsences = 0;
                    for (const record of history) {
                        if (record.status === 'absent') {
                            consecutiveAbsences++;
                        } else {
                            break;
                        }
                    }

                    console.log(`[AUTOMATION] Member ${item.member_id} streak: ${consecutiveAbsences}`);

                    if (consecutiveAbsences >= 3) {
                        const member = await get('SELECT first_name, last_name, cell_id, district_id FROM profiles WHERE id = ?', [item.member_id]);
                        if (!member) continue;

                        const today = new Date().toISOString().split('T')[0];
                        let title = '';
                        let description = '';
                        let assigneeId = null;
                        let priority = 'high';
                        let categorySuffix = '';

                        if (consecutiveAbsences === 3) {
                            const cell = await get('SELECT leader_id FROM cells WHERE id = ?', [member.cell_id]);
                            assigneeId = cell?.leader_id;
                            title = `Visita de cercanía: ${member.first_name} ${member.last_name}`;
                            description = `${member.first_name} ha faltado a 3 reuniones consecutivas. Por favor, realiza una visita de cercanía para conocer su estado y motivarle.`;
                            categorySuffix = 'streak-3';
                        } else if (consecutiveAbsences === 4) {
                            const district = await get('SELECT supervisor_id FROM districts WHERE id = ?', [member.district_id]);
                            assigneeId = district?.supervisor_id;
                            title = `Visita de supervisor: ${member.first_name} ${member.last_name}`;
                            description = `${member.first_name} ha alcanzado 4 inasistencias consecutivas. Se requiere una visita de supervisión tras el seguimiento del líder de célula.`;
                            categorySuffix = 'streak-4';
                        } else if (consecutiveAbsences >= 5) {
                            const pastors = await query("SELECT id FROM profiles WHERE role IN ('Pastor', 'Pastor Asociado') LIMIT 1");
                            assigneeId = pastors[0]?.id;
                            title = `Atención Pastoral: ${member.first_name} ${member.last_name}`;
                            description = `ALERTA: ${member.first_name} tiene ${consecutiveAbsences} inasistencias consecutivas. Requiere atención pastoral inmediata para evitar el abandono del proceso.`;
                            priority = 'urgent';
                            categorySuffix = 'streak-5'; // Keep suffix consistent for 5+ to avoid duplicate tasks per new absence
                        }

                        if (assigneeId) {
                            // IDEMPOTENCY: Check for existing task for THIS streak level category
                            const existingTask = await get(`
                                SELECT id FROM tasks 
                                WHERE related_member_id = ? 
                                AND category = ? 
                                AND status != 'cancelled'
                                AND created_at > date('now', '-30 days')
                            `, [item.member_id, `automation-${categorySuffix}`]);

                            if (!existingTask) {
                                await run(`
                                    INSERT INTO tasks (
                                        id, title, description, status, priority, category, 
                                        due_date, assigned_to_id, created_by_user_id, related_member_id, created_at
                                    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
                                `, [
                                    uuidv4(), title, description, priority,
                                    `automation-${categorySuffix}`, today, assigneeId,
                                    req.user.id, item.member_id, new Date().toISOString()
                                ]);
                                console.log(`[AUTOMATION] Created ${title} (Level: ${consecutiveAbsences})`);
                            }
                        }
                    }
                } catch (autoErr) {
                    console.error('[AUTOMATION] Error in attendance task trigger:', autoErr);
                }
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
