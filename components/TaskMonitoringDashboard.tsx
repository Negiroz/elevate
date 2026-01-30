
import React, { useState, useMemo } from 'react';
import { Task, User, Cell, District, UserRole } from '../types';

interface TaskMonitoringDashboardProps {
    tasks: Task[];
    users: User[];
    cells: Cell[];
    districts: District[];
    currentUser: User;
}

interface GroupedData {
    id: string;
    title: string;
    subtitle: string;
    totalTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    children?: GroupedData[];
    tasks?: Task[];
    type: 'district' | 'cell' | 'leader';
}

import TaskDetailModal from './TaskDetailModal';

const NodeItem: React.FC<{
    node: GroupedData;
    getPriorityColor: (p: string) => string;
    onTaskClick: (task: Task) => void;
}> = ({ node, getPriorityColor, onTaskClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const progress = node.totalTasks > 0 ? Math.round(((node.totalTasks - node.pendingTasks) / node.totalTasks) * 100) : 100;

    return (
        <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden transition-all duration-300 mb-4 shadow-sm">
            <div
                className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-white/5 transition-colors gap-4 ${isOpen ? 'bg-white/5' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${node.type === 'district' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
                        {node.type === 'district' ? 'D' : node.type === 'cell' ? 'C' : 'L'}
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-lg">{node.title}</h4>
                        <p className="text-text-secondary text-xs">{node.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex flex-col items-end min-w-[100px]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-white">{progress}%</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-center min-w-[40px]">
                            <span className="block text-lg font-black text-white">{node.pendingTasks}</span>
                            <span className="text-[9px] text-text-secondary uppercase tracking-wider">Pend.</span>
                        </div>
                        <div className="text-center min-w-[40px]">
                            <span className={`block text-lg font-black ${node.overdueTasks > 0 ? 'text-red-500' : 'text-text-secondary'}`}>{node.overdueTasks}</span>
                            <span className="text-[9px] text-text-secondary uppercase tracking-wider">Venc.</span>
                        </div>
                    </div>

                    <span className={`material-symbols-outlined text-text-secondary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </div>
            </div>

            {isOpen && (
                <div className="border-t border-border-dark bg-[#0a0f16] p-4 animate-in slide-in-from-top-2">
                    {node.children ? (
                        <div className="flex flex-col gap-2 pl-4 border-l border-border-dark/30 ml-2">
                            {node.children.map(child => (
                                <NodeItem key={child.id} node={child} getPriorityColor={getPriorityColor} onTaskClick={onTaskClick} />
                            ))}
                        </div>
                    ) : node.tasks ? (
                        <div className="grid grid-cols-1 gap-2">
                            {node.tasks.length === 0 ? (
                                <p className="text-text-secondary text-xs italic py-2 pl-2">No hay tareas pendientes.</p>
                            ) : (
                                node.tasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                        className="bg-[#111822] border border-border-dark/50 p-3 rounded-lg flex justify-between items-center group hover:border-primary/30 transition-colors cursor-pointer"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                                {task.status === 'completed' ? (
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-green-500/10 text-green-400">Completada</span>
                                                ) : new Date(task.dueDate) < new Date() && (
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-red-500/10 text-red-400">Vencida</span>
                                                )}
                                            </div>
                                            <p className="text-white font-bold text-sm">{task.title}</p>
                                        </div>
                                        <div className="text-right pl-4">
                                            <div className="flex items-center gap-1 text-text-secondary text-xs">
                                                <span className="material-symbols-outlined text-[14px]">event</span>
                                                {task.dueDate}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}

const TaskMonitoringDashboard: React.FC<TaskMonitoringDashboardProps> = ({ tasks, users, cells, districts, currentUser }) => {
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Include all tasks (removed filter for consolidation_local)
    const visibleTasks = useMemo(() => tasks, [tasks]);

    // Filter relevant tasks and build hierarchy
    const dashboardData = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];

        // Helper to user info
        const getUser = (id: string) => users.find(u => u.id === id);

        // 1. Identify Scope based on Role
        let scopeUsers: string[] = []; // Users whose tasks we want to monitor

        // PASTOR / ADMIN: All users
        if (currentUser.role === UserRole.PASTOR || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ASSOCIATE_PASTOR) {
            // We will group by District -> Cell -> Leader
            // Root nodes are Districts
            const districtGroups: GroupedData[] = districts.filter(d => d.active).map(district => {
                // Get cells in this district
                const distinctCells = cells.filter(c => c.districtId === district.id);

                const cellGroups: GroupedData[] = distinctCells.map(cell => {
                    // Get Leader
                    const leader = getUser(cell.leaderId);
                    if (!leader) return null;

                    // Get tasks assigned to this leader
                    const leaderTasks = visibleTasks
                        .filter(t => t.assignedToId === leader.id && t.status !== 'completed')
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

                    if (leaderTasks.length === 0) return null; // Hide empty if desired, or show 0

                    const pending = leaderTasks.filter(t => t.status !== 'completed').length;
                    const overdue = leaderTasks.filter(t => t.status !== 'completed' && t.due_date < today).length; // Note: task uses snake_case in DB but Camel in type? Check type definition in context mapping. 
                    // Context mapping `mapDbToTask` uses `dueDate`.
                    const overdueCount = leaderTasks.filter(t => t.status !== 'completed' && t.dueDate < today).length;

                    return {
                        id: `cell-${cell.id}`,
                        title: `Célula: ${cell.name}`,
                        subtitle: `Líder: ${leader.firstName} ${leader.lastName}`,
                        totalTasks: leaderTasks.length,
                        pendingTasks: pending,
                        overdueTasks: overdueCount,
                        type: 'cell',
                        tasks: leaderTasks
                    };
                }).filter(Boolean) as GroupedData[];

                // Aggregate District Stats (Cells)
                let total = cellGroups.reduce((acc, curr) => acc + curr.totalTasks, 0);
                let pending = cellGroups.reduce((acc, curr) => acc + curr.pendingTasks, 0);
                let overdue = cellGroups.reduce((acc, curr) => acc + curr.overdueTasks, 0);

                // Supervisor Direct Tasks
                const supervisor = getUser(district.supervisorId);
                let supervisorNode: GroupedData | null = null;

                if (supervisor) {
                    const supervisorTasks = visibleTasks
                        .filter(t => t.assignedToId === supervisor.id && t.status !== 'completed')
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

                    if (supervisorTasks.length > 0) {
                        const supPending = supervisorTasks.length; // Already filtered for non-completed
                        const supOverdue = supervisorTasks.filter(t => t.dueDate < today).length;

                        // Add to totals
                        total += supervisorTasks.length;
                        pending += supPending;
                        overdue += supOverdue;

                        supervisorNode = {
                            id: `sup-${district.id}`,
                            title: `Gestión Supervisor`,
                            subtitle: `${supervisor.firstName} ${supervisor.lastName}`,
                            totalTasks: supervisorTasks.length,
                            pendingTasks: supPending,
                            overdueTasks: supOverdue,
                            type: 'leader', // Render as a leaf node
                            tasks: supervisorTasks
                        };
                    }
                }

                const children = supervisorNode ? [supervisorNode, ...cellGroups] : cellGroups;

                return {
                    id: `district-${district.id}`,
                    title: district.name,
                    subtitle: `Supervisor: ${supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : 'Vacante'}`,
                    totalTasks: total,
                    pendingTasks: pending,
                    overdueTasks: overdue,
                    children: children,
                    type: 'district'
                };
            });

            // 2. Add Admin/Management Node
            const admins = users.filter(u => u.role === UserRole.ADMIN);
            let adminNode: GroupedData | null = null;

            // Collect all tasks assigned to ANY admin
            let allAdminTasks: Task[] = [];
            admins.forEach(admin => {
                const adminTasks = visibleTasks
                    .filter(t => t.assignedToId === admin.id && t.status !== 'completed')
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                allAdminTasks = [...allAdminTasks, ...adminTasks];
            });

            if (allAdminTasks.length > 0) {
                const pending = allAdminTasks.filter(t => t.status !== 'completed').length;
                const overdue = allAdminTasks.filter(t => t.status !== 'completed' && t.dueDate < today).length;

                adminNode = {
                    id: 'admin-group',
                    title: 'Administración',
                    subtitle: 'Tareas Generales / Sistema',
                    totalTasks: allAdminTasks.length,
                    pendingTasks: pending,
                    overdueTasks: overdue,
                    type: 'district', // Use district styling for top level
                    tasks: allAdminTasks // Leaf node style behavior if it has tasks directly? 
                    // The component supports children OR tasks. If we want lists of admins, we strictly need structure.
                    // But usually Admin is one or few. Let's just show tasks directly under "Administración" logic.
                    // However, NodeItem logic prefers `children` for 'district' type usually, or `tasks` for leaf.
                    // Let's force it to act as a container of tasks by NOT having children.
                };
            }

            return adminNode ? [adminNode, ...districtGroups] : districtGroups;
        }

        // DISTRICT SUPERVISOR: Only their district
        if (currentUser.role === UserRole.DISTRICT_SUPERVISOR) {
            const district = districts.find(d => d.supervisorId === currentUser.id);
            if (!district) return [];

            // Same logic as above but only for this district's cells
            const distinctCells = cells.filter(c => c.districtId === district.id);

            const cellGroups: GroupedData[] = distinctCells.map(cell => {
                const leader = getUser(cell.leaderId);
                if (!leader) return null;

                const leaderTasks = visibleTasks
                    .filter(t => t.assignedToId === leader.id && t.status !== 'completed')
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

                const pending = leaderTasks.filter(t => t.status !== 'completed').length;
                const overdueCount = leaderTasks.filter(t => t.status !== 'completed' && t.dueDate < today).length;

                return {
                    id: `cell-${cell.id}`,
                    title: cell.name,
                    subtitle: `Líder: ${leader.firstName} ${leader.lastName}`,
                    totalTasks: leaderTasks.length,
                    pendingTasks: pending,
                    overdueTasks: overdueCount,
                    type: 'cell',
                    tasks: leaderTasks // Leaf node contains tasks
                };
            }).filter(Boolean) as GroupedData[];

            return cellGroups; // Return list of Cells directly
        }

        // LEADER: Only themselves
        if (currentUser.role === UserRole.LEADER) {
            const myTasks = visibleTasks
                .filter(t => t.assignedToId === currentUser.id && t.status !== 'completed')
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const pending = myTasks.filter(t => t.status !== 'completed').length;
            const overdueCount = myTasks.filter(t => t.status !== 'completed' && t.dueDate < today).length;

            return [{
                id: `leader-${currentUser.id}`,
                title: 'Mis Tareas',
                subtitle: 'Gestión Personal',
                totalTasks: myTasks.length,
                pendingTasks: pending,
                overdueTasks: overdueCount,
                tasks: myTasks,
                type: 'leader'
            }];
        }

        return [];

    }, [tasks, users, cells, districts, currentUser]);

    // Stats for Top Cards
    const totalStats = useMemo(() => {
        const flatten = (nodes: GroupedData[]): GroupedData[] =>
            nodes.flatMap(n => n.children ? [n, ...flatten(n.children)] : [n]);

        const allNodes = flatten(dashboardData);
        // We only want to sum leaf nodes or root nodes? Careful with double counting.
        // Actually the `dashboardData` array items are roots.
        // If type is district, it aggregates children. So sum roots.

        return dashboardData.reduce((acc, curr) => ({
            total: acc.total + curr.totalTasks,
            pending: acc.pending + curr.pendingTasks,
            overdue: acc.overdue + curr.overdueTasks
        }), { total: 0, pending: 0, overdue: 0 });

    }, [dashboardData]);



    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'text-red-400 bg-red-400/10';
            case 'medium': return 'text-orange-400 bg-orange-400/10';
            case 'low': return 'text-emerald-400 bg-emerald-400/10';
            default: return 'text-gray-400 bg-gray-400/10';
        }
    };

    const canManageTasks = [UserRole.PASTOR, UserRole.ADMIN, UserRole.ASSOCIATE_PASTOR].includes(currentUser.role as UserRole);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#111822] p-6 rounded-2xl border border-border-dark flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <span className="material-symbols-outlined text-blue-400 text-2xl">assignment</span>
                    </div>
                    <div>
                        <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">Total Asignado</p>
                        <p className="text-3xl font-black text-white">{totalStats.total}</p>
                    </div>
                </div>
                <div className="bg-[#111822] p-6 rounded-2xl border border-border-dark flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl">
                        <span className="material-symbols-outlined text-orange-400 text-2xl">pending_actions</span>
                    </div>
                    <div>
                        <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">Pendientes</p>
                        <p className="text-3xl font-black text-white">{totalStats.pending}</p>
                    </div>
                </div>
                <div className="bg-[#111822] p-6 rounded-2xl border border-border-dark flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl">
                        <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
                    </div>
                    <div>
                        <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">Vencidas</p>
                        <p className="text-3xl font-black text-white">{totalStats.overdue}</p>
                    </div>
                </div>
            </div>

            {/* Tree View */}
            <div className="flex flex-col gap-4">
                {dashboardData.length === 0 ? (
                    <div className="text-center py-10 text-text-secondary">
                        <p>No hay datos disponibles para tu nivel de acceso.</p>
                    </div>
                ) : (
                    dashboardData.map(node => (
                        <NodeItem
                            key={node.id}
                            node={node}
                            getPriorityColor={getPriorityColor}
                            onTaskClick={setSelectedTask}
                        />
                    ))
                )}
            </div>

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    canManage={canManageTasks}
                />
            )}
        </div>
    );
};





export default TaskMonitoringDashboard;
