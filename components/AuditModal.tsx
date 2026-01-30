
import React from 'react';

interface AuditIssues {
    usersWithoutCell: any[];
    usersWithoutLeader: any[];
    cellsWithoutLeader: any[];
    incompleteProfiles: any[];
}

interface AuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    issues: AuditIssues | null;
    loading: boolean;
    errorMessage?: string;
}

const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose, issues, loading, errorMessage }) => {
    if (!isOpen) return null;

    const hasIssues = issues && (
        issues.usersWithoutCell.length > 0 ||
        issues.usersWithoutLeader.length > 0 ||
        issues.cellsWithoutLeader.length > 0 ||
        issues.incompleteProfiles.length > 0
    );

    // Helper to group by District
    const groupByDistrict = (items: any[]) => {
        const groups: Record<string, any[]> = {};
        items.forEach(item => {
            const d = item.district_name || 'Sin Distrito';
            if (!groups[d]) groups[d] = [];
            groups[d].push(item);
        });
        return groups;
    };

    // Helper to group by District then Cell
    const groupByDistrictAndCell = (items: any[]) => {
        const groups: Record<string, Record<string, any[]>> = {};
        items.forEach(item => {
            const d = item.district_name || 'Sin Distrito';
            const c = item.cell_name || 'Sin Célula';
            if (!groups[d]) groups[d] = {};
            if (!groups[d][c]) groups[d][c] = [];
            groups[d][c].push(item);
        });
        return groups;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#111822] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#1A2332]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">fact_check</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Auditoría del Sistema</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-500 text-[20px]">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-[#111822]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                            <p>Analizando datos del sistema...</p>
                        </div>
                    ) : errorMessage || !issues ? (
                        <div className="flex flex-col items-center justify-center py-12 text-red-500 text-center">
                            <span className="material-symbols-outlined text-6xl mb-4">error</span>
                            <h3 className="text-xl font-bold">Error al cargar</h3>
                            <p className="text-slate-500 mt-2">{errorMessage || "No se pudo obtener el reporte."}</p>
                        </div>
                    ) : !hasIssues ? (
                        <div className="flex flex-col items-center justify-center py-12 text-green-600 dark:text-green-400">
                            <span className="material-symbols-outlined text-6xl mb-4">check_circle</span>
                            <h3 className="text-xl font-bold">¡Todo en orden!</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">No se encontraron inconsistencias en el sistema.</p>
                        </div>
                    ) : (
                        <>
                            {issues?.usersWithoutCell.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-red-600 flex items-center gap-2 text-lg border-b border-red-100 pb-2">
                                        <span className="material-symbols-outlined">person_off</span>
                                        Usuarios Activos sin Célula ({issues.usersWithoutCell.length})
                                    </h3>
                                    <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-1 border border-red-100 dark:border-red-900/30">
                                        {Object.entries(groupByDistrict(issues.usersWithoutCell)).map(([district, users]) => (
                                            <div key={district} className="mb-4 last:mb-0 p-3">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide mb-2 opacity-80">{district}</h4>
                                                <div className="space-y-1 pl-2 border-l-2 border-red-200 dark:border-red-800">
                                                    {users.map((u: any) => (
                                                        <div key={u.id} className="text-sm text-slate-700 dark:text-slate-300 flex justify-between items-center px-2 py-1 hover:bg-red-100/50 rounded">
                                                            <span>{u.first_name} {u.last_name} <span className="text-xs text-slate-400">({u.role})</span></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {issues?.usersWithoutLeader.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-orange-600 flex items-center gap-2 text-lg border-b border-orange-100 pb-2">
                                        <span className="material-symbols-outlined">supervisor_account</span>
                                        Usuarios Activos sin Líder ({issues.usersWithoutLeader.length})
                                    </h3>
                                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-1 border border-orange-100 dark:border-orange-900/30">
                                        {Object.entries(groupByDistrictAndCell(issues.usersWithoutLeader)).map(([district, cells]) => (
                                            <div key={district} className="mb-4 last:mb-0 p-3">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide mb-2 opacity-80">{district}</h4>
                                                <div className="pl-2 space-y-3">
                                                    {Object.entries(cells).map(([cell, users]) => (
                                                        <div key={cell}>
                                                            <h5 className="font-semibold text-orange-700 dark:text-orange-400 text-sm mb-1">{cell}</h5>
                                                            <div className="space-y-1 pl-2 border-l-2 border-orange-200 dark:border-orange-800">
                                                                {users.map((u: any) => (
                                                                    <div key={u.id} className="text-sm text-slate-700 dark:text-slate-300 px-2 py-1 hover:bg-orange-100/50 rounded">
                                                                        {u.first_name} {u.last_name} <span className="text-xs text-slate-400">({u.role})</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {issues?.cellsWithoutLeader.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-amber-600 flex items-center gap-2 text-lg border-b border-amber-100 pb-2">
                                        <span className="material-symbols-outlined">group_off</span>
                                        Células Activas sin Líder ({issues.cellsWithoutLeader.length})
                                    </h3>
                                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-1 border border-amber-100 dark:border-amber-900/30">
                                        {Object.entries(groupByDistrict(issues.cellsWithoutLeader)).map(([district, cells]) => (
                                            <div key={district} className="mb-4 last:mb-0 p-3">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide mb-2 opacity-80">{district}</h4>
                                                <div className="space-y-1 pl-2 border-l-2 border-amber-200 dark:border-amber-800">
                                                    {cells.map((c: any) => (
                                                        <div key={c.id} className="text-sm text-slate-700 dark:text-slate-300 px-2 py-1 hover:bg-amber-100/50 rounded">
                                                            {c.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {issues?.incompleteProfiles.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-yellow-600 flex items-center gap-2 text-lg border-b border-yellow-100 pb-2">
                                        <span className="material-symbols-outlined">warning</span>
                                        Perfiles Incompletos ({issues.incompleteProfiles.length})
                                    </h3>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-1 border border-yellow-100 dark:border-yellow-900/30">
                                        {Object.entries(groupByDistrictAndCell(issues.incompleteProfiles)).map(([district, cells]) => (
                                            <div key={district} className="mb-4 last:mb-0 p-3">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide mb-2 opacity-80">{district}</h4>
                                                <div className="pl-2 space-y-3">
                                                    {Object.entries(cells).map(([cell, users]) => (
                                                        <div key={cell}>
                                                            <h5 className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm mb-1">{cell}</h5>
                                                            <div className="space-y-1 pl-2 border-l-2 border-yellow-200 dark:border-yellow-800">
                                                                {users.map((u: any) => (
                                                                    <div key={u.id} className="text-sm text-slate-700 dark:text-slate-300 px-2 py-1 hover:bg-yellow-100/50 rounded flex justify-between">
                                                                        <span>{u.first_name} {u.last_name}</span>
                                                                        <span className="text-xs text-orange-500 bg-orange-100 px-2 rounded-full">
                                                                            {!u.phone ? 'Falta tel. ' : ''}
                                                                            {!u.address ? 'Falta dir.' : ''}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#1A2332] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white dark:bg-[#111822] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-800 font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuditModal;
