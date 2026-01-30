import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useUsers } from '../UserContext';
import { UserRole } from '../types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


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

const OfferingReportContent: React.FC = () => {
    const { user } = useUsers();
    const [reports, setReports] = useState<OfferingReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterDistrict, setFilterDistrict] = useState('Todos');

    // Time Filters
    const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week'>('month');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await api.get('/offerings');
            console.log('Offerings Data:', res);
            setReports(Array.isArray(res) ? res : []);
        } catch (error) {
            console.error("Error fetching offerings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Derived Data
    const uniqueDistricts = useMemo(() => {
        const dists = new Set(reports.map(r => r.district_name || 'Sin Asignar'));
        return ['Todos', ...Array.from(dists)];
    }, [reports]);

    const filteredReports = useMemo(() => {
        let filtered = reports;

        // District Filter
        if (filterDistrict !== 'Todos') {
            filtered = filtered.filter(r => (r.district_name || 'Sin Asignar') === filterDistrict);
        }

        // Time Filter
        if (timeFilter !== 'all' && selectedDate) {
            const date = parseISO(selectedDate);
            let start, end;

            if (timeFilter === 'week') {
                start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
                end = endOfWeek(date, { weekStartsOn: 1 });
            } else {
                start = startOfMonth(date);
                end = endOfMonth(date);
            }

            filtered = filtered.filter(r => {
                // Fix timezone offset issue by treating date as local string yyyy-mm-dd
                // The report.date is "YYYY-MM-DD". parseISO might shift it depending on local time.
                // Safest comparison involves string comparison or correct parsing.
                // Assuming report.date is YYYY-MM-DD.
                const rDate = parseISO(r.date);
                return isWithinInterval(rDate, { start, end });
            });
        }

        return filtered;
    }, [reports, filterDistrict, timeFilter, selectedDate]);

    const exportPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(17, 24, 34); // Surface Dark
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Resumen de Ofrendas", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(200, 200, 200);
        doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, 30);

        // Filter Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        let filterText = `Filtro: ${timeFilter === 'all' ? 'Todo el historial' : timeFilter === 'month' ? 'Mensual' : 'Semanal'}`;
        if (timeFilter !== 'all') {
            filterText += ` - ${format(parseISO(selectedDate), timeFilter === 'month' ? 'MMMM yyyy' : "'Semana del ' dd 'de' MMMM", { locale: es })}`;
        }
        if (filterDistrict !== 'Todos') filterText += ` | Distrito: ${filterDistrict}`;

        doc.text(filterText, 14, 50);

        // Table
        const tableColumn = ["Fecha", "Célula", "Distrito", "Efectivo (Bs)", "Efectivo ($)", "Transf."];
        const tableRows = filteredReports.map(r => [
            r.date,
            r.cell_name,
            r.district_name || 'Sin Asignar',
            Number(r.cash_bs).toFixed(2),
            Number(r.cash_usd).toFixed(2),
            Number(r.transfer).toFixed(2)
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [66, 133, 244], textColor: 255 },
            styles: { fontSize: 8 },
            foot: [[
                "TOTALES",
                "",
                "",
                Number(totals.bs).toFixed(2),
                Number(totals.usd).toFixed(2),
                Number(totals.transfer).toFixed(2)
            ]],
            footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
        });

        doc.save(`reporte_ofrendas_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    const totals = useMemo(() => {
        return filteredReports.reduce((acc, curr) => ({
            bs: acc.bs + Number(curr.cash_bs || 0),
            usd: acc.usd + Number(curr.cash_usd || 0),
            transfer: acc.transfer + Number(curr.transfer || 0)
        }), { bs: 0, usd: 0, transfer: 0 });
    }, [filteredReports]);

    if (isLoading) {
        return <div className="p-10 text-center text-white">Cargando reporte...</div>;
    }

    if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.PASTOR && user?.role !== UserRole.ASSOCIATE_PASTOR && user?.role !== UserRole.DISTRICT_SUPERVISOR) {
        return <div className="p-10 text-center text-red-500 font-bold">No tienes permisos para ver esta sección.</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-dark p-4 rounded-2xl border border-border-dark">
                <div>
                    <h2 className="text-2xl font-black text-white">Resumen de Ofrendas</h2>
                    <p className="text-text-secondary text-sm">Detalle de ingresos por células y distritos.</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Time Filter Mode */}
                    <div className="flex bg-[#111822] rounded-lg p-1 border border-border-dark">
                        <button
                            onClick={() => setTimeFilter('week')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeFilter === 'week' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setTimeFilter('month')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeFilter === 'month' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'}`}
                        >
                            Mes
                        </button>
                        <button
                            onClick={() => setTimeFilter('all')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeFilter === 'all' ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'}`}
                        >
                            Todo
                        </button>
                    </div>

                    {/* Date Picker */}
                    {timeFilter !== 'all' && (
                        <input
                            type={timeFilter === 'month' ? 'month' : 'date'}
                            value={timeFilter === 'month' ? selectedDate.substring(0, 7) : selectedDate}
                            onChange={(e) => {
                                // For month input, e.target.value is YYYY-MM. We append -01 to make it a full date
                                const newVal = timeFilter === 'month' ? `${e.target.value}-01` : e.target.value;
                                setSelectedDate(newVal);
                            }}
                            className="bg-[#111822] border border-border-dark text-white rounded-xl px-3 py-2 outline-none text-sm w-40"
                        />
                    )}

                    {/* District Filter */}
                    <select
                        value={filterDistrict}
                        onChange={e => setFilterDistrict(e.target.value)}
                        className="bg-[#111822] border border-border-dark text-white rounded-xl px-4 py-2 focus:ring-primary outline-none text-sm"
                    >
                        {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    {/* PDF Export Button */}
                    <button
                        onClick={exportPDF}
                        disabled={filteredReports.length === 0}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
                        title="Descargar PDF"
                    >
                        <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                    </button>
                </div>
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
                                            {Number(report.cash_bs).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-blue-400 text-right">
                                            {Number(report.cash_usd).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-purple-400 text-right">
                                            {Number(report.transfer).toFixed(2)}
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
    );
};

export default OfferingReportContent;
