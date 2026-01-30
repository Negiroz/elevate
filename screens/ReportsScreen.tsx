import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useLocation } from 'react-router-dom';

import { api } from '../lib/api';
import { useCells } from '../CellContext';
import { useUsers } from '../UserContext';
import { useConsolidation } from '../ConsolidationContext';
import { useTasks } from '../TaskContext';
import { useDistricts } from '../DistrictContext';
import TaskMonitoringDashboard from '../components/TaskMonitoringDashboard';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNotification } from '../NotificationContext';
import OfferingReportContent from '../components/OfferingReportContent';
import { UserRole } from '../types';

interface AttendanceReport {
    id: string; // Composite key
    date: string;
    type: string;
    cellId: string;
    presentCount: number;
    totalCount: number;
    districtId?: string;
}

const AttendanceDetailsModal: React.FC<{
    report: AttendanceReport;
    onClose: () => void;
    onUpdate: () => void;
}> = ({ report, onClose, onUpdate }) => {
    const navigate = useNavigate();
    const { users } = useUsers();
    const { cells } = useCells();
    const { tasks } = useConsolidation();
    const { showNotification } = useNotification();
    const [details, setDetails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadDetails();
    }, [report]);

    const loadDetails = async () => {
        try {
            // Fetch records via API
            let endpoint = `/attendance?date=${report.date}&type=${report.type}`;
            if (report.cellId && report.cellId !== 'unknown') {
                endpoint += `&cell_id=${report.cellId}`;
            }

            const data = await api.get(endpoint);

            // Map records to displayable details
            const mappedDetails = data.map((record: any) => {
                let name = 'Desconocido';
                let imageUrl = '';
                let role = 'Miembro';

                if (record.member_id) {
                    const user = users.find(u => u.id === record.member_id);
                    if (user) {
                        name = `${user.firstName} ${user.lastName}`;
                        imageUrl = user.imageUrl || '';
                        role = user.role;
                    }
                } else if (record.candidate_id) {
                    // Logic for legacy 'candidate_id' which is now just member ID in our schema?
                    // Or if we still support candidate distinction in API?
                    // In our migrated schema cell_attendance has `member_id` (FK profiles).
                    // We removed candidate_id column in database.js unless I included it?
                    // Checking database.js... I did NOT include `candidate_id` in `cell_attendance` table! 
                    // I only put `member_id`. 
                    // So we must assume all are members now (profile table handles both).
                    const user = users.find(u => u.id === record.member_id);
                    // Or if I check consolidation Logic?
                    // Consolidation tasks ARE profiles now.
                    if (user) {
                        name = `${user.firstName} ${user.lastName}`;
                        role = user.consolidationStageId ? 'Candidato' : user.role;
                    }
                }

                return {
                    id: record.id,
                    member_id: record.member_id,
                    name,
                    imageUrl: imageUrl || `https://picsum.photos/seed/${record.id}/100/100`,
                    role,
                    status: record.status
                };
            });

            // Sort: Absents first, then Presents; then Alphabetical by Name
            mappedDetails.sort((a: any, b: any) => {
                // Primary: Status (absent < present)
                if (a.status !== b.status) {
                    // 'absent' comes before 'present' in alphabetical order, so this puts Absents first
                    return a.status.localeCompare(b.status);
                }
                // Secondary: Name (A-Z)
                return a.name.localeCompare(b.name);
            });

            setDetails(mappedDetails);
        } catch (error) {
            console.error('Error loading details:', error);
            showNotification('Error al cargar detalles.', 'error');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = (id: string) => {
        setDetails(prev => prev.map(d =>
            d.id === id ? { ...d, status: d.status === 'present' ? 'absent' : 'present' } : d
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = details.map(d => ({
                member_id: d.member_id,
                cell_id: report.cellId !== 'unknown' ? report.cellId : null,
                date: report.date,
                type: report.type,
                status: d.status
            }));

            await api.post('/attendance', updates);
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Error saving updates:', error);
            showNotification('Error al guardar cambios.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#111822] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-border-dark flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border-dark flex justify-between items-center bg-surface-dark">
                    <div>
                        <h3 className="text-xl font-black text-white">Editar Asistencia</h3>
                        <div className="flex flex-col gap-1 mt-1">
                            <p className="text-text-secondary text-xs">
                                {formatDate(report.date)} • {report.type === 'cell' ? 'Célula' : report.type === 'event' ? 'Evento' : 'Servicio'}
                            </p>
                            {(report.type === 'cell' || report.cellId !== 'unknown') && (() => {
                                const cell = cells.find(c => c.id === report.cellId);
                                const leader = cell ? users.find(u => u.id === cell.leaderId) : null;
                                return cell ? (
                                    <p className="text-primary text-xs font-bold">
                                        {cell.name} • <span className="text-white font-normal">{leader ? `${leader.firstName} ${leader.lastName}` : 'Sin Líder'}</span>
                                    </p>
                                ) : null;
                            })()}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <span className="material-symbols-outlined text-text-secondary">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="py-20 text-center text-text-secondary">Cargando asistentes...</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {details.map(detail => (
                                <div key={detail.id} onClick={() => toggleStatus(detail.id)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${detail.status === 'present'
                                    ? 'bg-primary/10 border-primary/30'
                                    : 'bg-surface-dark border-border-dark hover:border-border-light'
                                    }`}>
                                    <div className="flex items-center gap-4">
                                        <img src={detail.imageUrl} className="w-10 h-10 rounded-full border border-white/10 object-cover" />
                                        <div>
                                            <p className={`font-bold text-sm ${detail.status === 'present' ? 'text-white' : 'text-text-secondary'}`}>{detail.name}</p>
                                            <p className="text-[10px] text-text-secondary uppercase tracking-wider">{detail.role}</p>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 ${detail.status === 'present' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-text-secondary'
                                        }`}>
                                        {detail.status === 'present' ? 'Presente' : 'Ausente'}
                                        <div className={`w-2 h-2 rounded-full ${detail.status === 'present' ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border-dark bg-surface-dark flex justify-between gap-4">
                    <button
                        onClick={() => {
                            navigate(`/cells/attendance/${report.cellId}?date=${report.date}`);
                        }}
                        className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold hover:bg-primary/20 transition-all flex items-center gap-2 text-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit_document</span>
                        Ver / Editar Detalles
                    </button>
                    <div className="flex gap-4 ml-auto">
                        <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold text-text-secondary hover:bg-white/5 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 rounded-xl font-black bg-primary text-white shadow-lg shadow-primary/20 hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface DistrictReportGroupProps {
    districtId: string;
    reports: AttendanceReport[];
    districts: any[];
    cells: any[];
    totalCellsCount: number;
    onSelectReport: (report: AttendanceReport) => void;
    onDeleteReport: (report: AttendanceReport) => void;
}

const DistrictReportGroup: React.FC<DistrictReportGroupProps> = ({ districtId, reports, districts, cells, totalCellsCount, onSelectReport, onDeleteReport }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate District Stats
    const totalPresent = reports.reduce((sum, r) => sum + r.presentCount, 0);
    const totalPossible = reports.reduce((sum, r) => sum + r.totalCount, 0);
    const avgEffectiveness = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;

    // Coverage Stats
    const uniqueReportedCells = new Set(reports.filter(r => r.type === 'cell').map(r => r.cellId)).size;
    const uniqueReportedServices = new Set(reports.filter(r => r.type === 'event' || r.type === 'service').map(r => r.cellId)).size;

    const districtName = districts.find(d => d.id === districtId)?.name || 'Sin Distrito asignado';

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getCellName = (id: string) => cells.find(c => c.id === id)?.name || 'Célula Eliminada';

    // Sort reports within district by efficiency desc
    const sortedReports = [...reports].sort((a, b) => {
        const effA = a.totalCount > 0 ? (a.presentCount / a.totalCount) : 0;
        const effB = b.totalCount > 0 ? (b.presentCount / b.totalCount) : 0;
        return effB - effA;
    });

    const isMissingReports = uniqueReportedCells < totalCellsCount;

    return (
        <div className="flex flex-col gap-3">
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-4 pl-2 border-l-4 ${isMissingReports ? 'border-yellow-500' : 'border-emerald-500'} cursor-pointer hover:bg-white/5 p-2 rounded-r-lg transition-colors select-none`}
            >
                <div className="bg-surface-light/10 p-1 rounded-full text-text-secondary">
                    <span className="material-symbols-outlined transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        chevron_right
                    </span>
                </div>
                <h2 className="text-xl font-bold text-white flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                    <span>{districtName}</span>
                    {isMissingReports && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full w-fit">Faltan Reportes</span>}
                </h2>
                <div className="flex flex-wrap gap-2 md:gap-4 justify-end">
                    <div className="flex items-center gap-2 bg-surface-light/5 px-3 py-1 rounded-full border border-white/5" title="Asistencia a Célula">
                        <span className="text-text-secondary text-xs font-bold uppercase tracking-wider">Cél:</span>
                        <span className={`font-black ${uniqueReportedCells < totalCellsCount ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {uniqueReportedCells}/{totalCellsCount}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 bg-surface-light/5 px-3 py-1 rounded-full border border-white/5" title="Asistencia a Servicios">
                        <span className="text-text-secondary text-xs font-bold uppercase tracking-wider">Ser:</span>
                        <span className={`font-black ${uniqueReportedServices < totalCellsCount ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {uniqueReportedServices}/{totalCellsCount}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 bg-surface-light/5 px-3 py-1 rounded-full border border-white/5">
                        <span className="text-text-secondary text-xs font-bold uppercase tracking-wider">Efe:</span>
                        <span className={`font-black ${avgEffectiveness >= 80 ? 'text-emerald-400' : avgEffectiveness >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {Math.round(avgEffectiveness)}%
                        </span>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#111822] text-text-secondary text-[10px] uppercase tracking-widest font-black">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Célula</th>
                                    <th className="px-6 py-4 text-center">Asistencia</th>
                                    <th className="px-6 py-4 text-center">% Efectividad</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {sortedReports.map((report) => {
                                    const percentage = Math.round((report.presentCount / report.totalCount) * 100) || 0;
                                    return (
                                        <tr
                                            key={report.id}
                                            onClick={() => onSelectReport(report)}
                                            className="hover:bg-white/5 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4 text-white font-medium">
                                                {formatDate(report.date)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${report.type === 'cell' ? 'bg-blue-500/10 text-blue-400' :
                                                    report.type === 'event' ? 'bg-cyan-500/10 text-cyan-400' :
                                                        'bg-purple-500/10 text-purple-400'
                                                    }`}>
                                                    {report.type === 'cell' ? 'Célula' : report.type === 'event' ? 'Evento' : 'Servicio'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white font-bold">
                                                {getCellName(report.cellId)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-emerald-400 font-black text-lg">{report.presentCount}</span>
                                                <span className="text-text-secondary text-xs"> / {report.totalCount}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${percentage >= 80 ? 'bg-emerald-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-white">{percentage}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteReport(report); }}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-text-secondary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Eliminar Reporte"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};




const ReportsScreen: React.FC = () => {
    const navigate = useNavigate();
    const { cells } = useCells();
    const { users, user } = useUsers();
    const { tasks: consolidationTasks } = useConsolidation();
    const { tasks } = useTasks();
    const { districts } = useDistricts();
    const { showNotification } = useNotification();

    const [reports, setReports] = useState<AttendanceReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<AttendanceReport | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; report: AttendanceReport | null }>({
        isOpen: false,
        report: null
    });
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'attendance' | 'tasks' | 'offerings'>('attendance');
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        if (location.state && (location.state as any).tab) {
            setActiveTab((location.state as any).tab);
        }
    }, [location]);

    const getStartOfWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    };

    const getEndOfWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? 0 : 7); // adjust when day is sunday
        return new Date(d.setDate(diff));
    };

    const nextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const prevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = getEndOfWeek(currentDate);

    // Format for display
    const weekRangeDisplay = `${startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;

    const currentUser = users.find(u => u.id === user?.id) || (user as any);

    useEffect(() => {
        if (users.length > 0) {
            fetchReports();
        }
    }, [users, consolidationTasks]);

    const fetchReports = async () => {
        try {
            const data = await api.get('/attendance');

            // Client-side aggregation
            const groupedArgs: Record<string, { present: number, total: number }> = {};

            data.forEach((record: any) => {
                // Filter by role if needed (client side for simplicity or params)
                if (user?.role === 'Líder de Célula' && user.cellId && record.cell_id !== user.cellId) {
                    return;
                }

                let cellId = record.cell_id;

                if (!cellId) {
                    // Try to infer from member
                    var member = users.find(u => u.id === record.member_id);
                    var memberCellId = member?.cellId;
                    cellId = memberCellId;
                }

                if (!cellId) cellId = 'unknown';

                const key = `${record.date}|${record.type}|${cellId}`;

                if (!groupedArgs[key]) {
                    groupedArgs[key] = { present: 0, total: 0 };
                }

                groupedArgs[key].total++;
                if (record.status === 'present') {
                    groupedArgs[key].present++;
                }
            });

            const parsedReports: AttendanceReport[] = Object.entries(groupedArgs).map(([key, stats]) => {
                const [date, type, cellId] = key.split('|');
                const cell = cells.find(c => c.id === cellId);
                const districtId = cell?.districtId;

                return {
                    id: key,
                    date,
                    type,
                    cellId,
                    districtId,
                    presentCount: stats.present,
                    totalCount: stats.total
                };
            }).filter(r => r.cellId !== 'unknown');

            // Sort by date desc
            parsedReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setReports(parsedReports);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteReportCallback = async (report: AttendanceReport) => {
        // Renamed to callback to be used by confirmDelete
        try {
            setLoading(true);

            // Fetch IDs to delete
            const endpoint = `/attendance?date=${report.date}&type=${report.type}&cell_id=${report.cellId}`;
            const records = await api.get(endpoint);
            const idsToDelete = records.map((r: any) => r.id);

            if (idsToDelete.length === 0) {
                showNotification('No se encontraron registros coincidentes para eliminar.', 'warning');
                return;
            }

            await api.post('/attendance/delete', { ids: idsToDelete });
            fetchReports();
        } catch (error: any) {
            console.error('Error deleting report:', error);
            showNotification(`Error al eliminar: ${error.message || 'Error desconocido'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const requestDelete = (report: AttendanceReport) => {
        setDeleteModal({ isOpen: true, report });
    };

    const confirmDeleteReport = async () => {
        if (deleteModal.report) {
            await deleteReportCallback(deleteModal.report);
            setDeleteModal({ isOpen: false, report: null });
        }
    };

    const getCellName = (id: string) => cells.find(c => c.id === id)?.name || 'Célula Eliminada';

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <Layout title="Reportes y Estadísticas">
            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                onConfirm={confirmDeleteReport}
                title="Eliminar Reporte"
                message="¿Estás seguro de eliminar este reporte de asistencia? Esta acción no se puede deshacer."
                confirmText="Sí, Eliminar"
                cancelText="Cancelar"
            />
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white">Panel de Control</h1>
                        <p className="text-text-secondary text-sm">Visión general del ministerio.</p>
                    </div>

                    <div className="bg-[#111822] p-1 rounded-xl border border-border-dark flex">
                        <button
                            onClick={() => setActiveTab('attendance')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'attendance' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
                        >
                            Asistencia
                        </button>
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tasks' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
                        >
                            Control de Tareas
                        </button>
                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.PASTOR || user?.role === UserRole.ASSOCIATE_PASTOR || user?.role === UserRole.DISTRICT_SUPERVISOR) && (
                            <button
                                onClick={() => setActiveTab('offerings')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'offerings' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-white'}`}
                            >
                                Ofrendas
                            </button>
                        )}
                    </div>
                </div>

                {activeTab === 'attendance' && (
                    <div className="flex items-center justify-between bg-surface-dark border border-border-dark p-2 rounded-xl">
                        <button onClick={prevWeek} className="p-2 hover:bg-white/5 rounded-lg text-text-secondary hover:text-white transition-colors">
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">calendar_today</span>
                            <span className="text-white font-bold capitalize">{weekRangeDisplay}</span>
                        </div>
                        <button onClick={nextWeek} className="p-2 hover:bg-white/5 rounded-lg text-text-secondary hover:text-white transition-colors">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                )}

                {activeTab === 'attendance' && (
                    <div className="flex flex-col gap-6">
                        {loading ? (
                            <div className="p-12 text-center text-text-secondary">Cargando datos...</div>
                        ) : reports.length === 0 ? (
                            <div className="p-12 text-center text-text-secondary">No hay reportes registrados aún.</div>
                        ) : (
                            Object.entries(
                                reports.filter(r => {
                                    const reportDate = new Date(r.date);
                                    // Set time to midnight for accurate day comparison
                                    reportDate.setHours(0, 0, 0, 0);
                                    startOfWeek.setHours(0, 0, 0, 0);
                                    endOfWeek.setHours(23, 59, 59, 999);
                                    return reportDate >= startOfWeek && reportDate <= endOfWeek;
                                }).reduce((acc, report) => {
                                    const districtId = report.districtId || 'unknown';
                                    if (!acc[districtId]) acc[districtId] = [];
                                    acc[districtId].push(report);
                                    return acc;
                                }, {} as Record<string, AttendanceReport[]>)
                            )
                                .map(([districtId, reports]: [string, AttendanceReport[]]) => {
                                    // Calculate District Stats for Sorting only
                                    const totalPresent = reports.reduce((sum, r) => sum + r.presentCount, 0);
                                    const totalPossible = reports.reduce((sum, r) => sum + r.totalCount, 0);
                                    const avgEffectiveness = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;

                                    // Count total cells in this district (from global context)
                                    const totalCellsInDistrict = cells.filter(c => c.districtId === districtId).length;

                                    return {
                                        districtId,
                                        reports,
                                        avgEffectiveness,
                                        totalCellsInDistrict
                                    };
                                })
                                .sort((a, b) => b.avgEffectiveness - a.avgEffectiveness) // Sort Districts by Efficiency Desc
                                .map(({ districtId, reports, totalCellsInDistrict }) => (
                                    <DistrictReportGroup
                                        key={districtId}
                                        districtId={districtId}
                                        reports={reports}
                                        districts={districts}
                                        cells={cells}
                                        totalCellsCount={totalCellsInDistrict}
                                        onSelectReport={(report) => navigate(`/cells/attendance/${report.cellId}?date=${report.date}&type=${report.type}`)}
                                        onDeleteReport={requestDelete}
                                    />
                                ))
                        )}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <TaskMonitoringDashboard
                        tasks={[...tasks, ...consolidationTasks.filter(t => t.visitDate).map(t => {
                            // Synthesize Virtual Task for Visits
                            const visitDate = new Date(t.visitDate!);
                            const now = new Date();
                            const isOverdue = visitDate < now;
                            const leaderId = cells.find(c => c.id === t.cellId)?.leaderId || 'unknown';

                            return {
                                id: `virtual - visit - ${t.id} `,
                                title: `Visita: ${t.name} `,
                                description: `Etapa: ${t.stage} `, // Could resolve stage name if needed
                                status: 'pending',
                                priority: isOverdue ? 'high' : 'medium',
                                category: 'visit',
                                dueDate: t.visitDate!.split('T')[0], // Extract YYYY-MM-DD
                                createdAt: new Date().toISOString(),
                                assignedToId: leaderId,
                                createdByUserId: 'system',
                                relatedMemberId: t.relatedMemberId
                            } as any; // Cast to Task (some fields might be missing strict type match but enough for dashboard)
                        })].filter(t => {
                            if (user?.role === 'Líder de Célula') {
                                const relatedMember = users.find(u => u.id === t.relatedMemberId);
                                const isMyCellMember = relatedMember?.cellId === user.cellId;
                                const isAssignedToMe = t.assignedToId === user.id;
                                return isMyCellMember || isAssignedToMe;
                            }
                            return true;
                        })}
                        users={users}
                        cells={cells}
                        districts={districts}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === 'offerings' && (
                    <OfferingReportContent />
                )}
            </div>
            {selectedReport && (
                <AttendanceDetailsModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                    onUpdate={() => {
                        fetchReports();
                    }}
                />
            )}
        </Layout>
    );
};

export default ReportsScreen;
