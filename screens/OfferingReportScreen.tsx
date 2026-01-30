import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { useUsers } from '../UserContext';
import { UserRole } from '../types';

interface OfferingReport {
    id: string;
    cell_id: string;
    cell_name: string;
    district_name: string;
    date: string;
    cash_bs: number;
    cash_usd: number;
    transfer: number;
    created_at: string;
}

const OfferingReportScreen: React.FC = () => {
    const { user } = useUsers();
    const [reports, setReports] = useState<OfferingReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterDistrict, setFilterDistrict] = useState('Todos');

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await api.get('/offerings');
            setReports(res.data);
        } catch (error) {
            console.error("Error fetching offerings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Derived Data
    const uniqueDistricts = useMemo(() => {
        const dists = new Set(reports.map(r => r.district_name));
        return ['Todos', ...Array.from(dists)];
    }, [reports]);

    const filteredReports = useMemo(() => {
        return reports.filter(r => filterDistrict === 'Todos' || r.district_name === filterDistrict);
    }, [reports, filterDistrict]);

    const totals = useMemo(() => {
        return filteredReports.reduce((acc, curr) => ({
            bs: acc.bs + curr.cash_bs,
            usd: acc.usd + curr.cash_usd,
            transfer: acc.transfer + curr.transfer
        }), { bs: 0, usd: 0, transfer: 0 });
    }, [filteredReports]);

    if (isLoading) {
        return <Layout title="Reporte de Ofrendas"><div className="p-10 text-center text-white">Cargando reporte...</div></Layout>;
    }

    if (user?.role !== UserRole.ADMIN && user?.role !== 'Pastor Principal' && user?.role !== UserRole.DISTRICT_SUPERVISOR) {
        return <Layout title="Acceso Denegado"><div className="p-10 text-center text-red-500 font-bold">No tienes permisos para ver esta sección.</div></Layout>;
    }

    return (
        <Layout title="Reporte de Ofrendas">
            <div className="max-w-7xl mx-auto space-y-8">

                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white">Reporte de Ofrendas</h1>
                        <p className="text-text-secondary text-sm">Resumen de ingresos por células y distritos.</p>
                    </div>

                    <select
                        value={filterDistrict}
                        onChange={e => setFilterDistrict(e.target.value)}
                        className="bg-[#111822] border border-border-dark text-white rounded-xl px-4 py-2 focus:ring-primary outline-none"
                    >
                        {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                {/* Totales Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-emerald-500">payments</span>
                        </div>
                        <p className="text-text-secondary text-xs uppercase font-black tracking-widest mb-1">Total Efectivo (Bs)</p>
                        <p className="text-3xl font-black text-white">Bs {totals.bs.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-blue-500">attach_money</span>
                        </div>
                        <p className="text-text-secondary text-xs uppercase font-black tracking-widest mb-1">Total Efectivo ($)</p>
                        <p className="text-3xl font-black text-white">$ {totals.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-purple-500">credit_card</span>
                        </div>
                        <p className="text-text-secondary text-xs uppercase font-black tracking-widest mb-1">Total Transferencia</p>
                        <p className="text-3xl font-black text-white">Bs {totals.transfer.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Tabla Detallada */}
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[#111822] border-b border-border-dark text-left">
                                    <th className="px-6 py-4 text-xs font-black text-text-secondary uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-4 text-xs font-black text-text-secondary uppercase tracking-wider">Distrito</th>
                                    <th className="px-6 py-4 text-xs font-black text-text-secondary uppercase tracking-wider">Célula</th>
                                    <th className="px-6 py-4 text-xs font-black text-text-secondary uppercase tracking-wider text-right">Efectivo (Bs)</th>
                                    <th className="px-6 py-4 text-xs font-black text-text-secondary uppercase tracking-wider text-right">Efectivo ($)</th>
                                    <th className="px-6 py-4 text-xs font-black text-text-secondary uppercase tracking-wider text-right">Transf.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark/50">
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-text-secondary font-medium">
                                            No hay reportes registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map(report => (
                                        <tr key={report.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-white whitespace-nowrap">
                                                {new Date(report.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-text-secondary">
                                                <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-bold uppercase">{report.district_name}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-white">{report.cell_name}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-emerald-400 text-right">
                                                {report.cash_bs.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-blue-400 text-right">
                                                {report.cash_usd.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-purple-400 text-right">
                                                {report.transfer.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {/* Footer Totals Row */}
                            {filteredReports.length > 0 && (
                                <tfoot className="bg-[#111822] border-t border-border-dark font-black">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-right text-text-secondary uppercase text-xs tracking-wider">Total Filtrado:</td>
                                        <td className="px-6 py-4 text-right text-emerald-400">{totals.bs.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right text-blue-400">{totals.usd.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right text-purple-400">{totals.transfer.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

            </div>
        </Layout>
    );
};

export default OfferingReportScreen;
