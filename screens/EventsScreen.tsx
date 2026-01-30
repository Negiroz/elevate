import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useEvents } from '../EventContext';
import { useNotification } from '../NotificationContext';
import { useCells } from '../CellContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportRow {
    districtId: string;
    districtName: string;
    activeMembers: number;
    attendance: number;
    percentage: number;
    conversions: number;
    total: number;
}

const EventReportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    eventName: string;
    reportData: ReportRow[];
    loading: boolean;
}> = ({ isOpen, onClose, eventName, reportData, loading }) => {
    if (!isOpen) return null;

    const exportPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(17, 24, 34); // Dark Background
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Reporte de Evento", 14, 20);
        doc.setFontSize(12);
        doc.setTextColor(161, 161, 170); // Text Secondary
        doc.text(eventName, 14, 30);

        // Table
        autoTable(doc, {
            startY: 45,
            head: [['Distrito', 'Miembros Activos', 'Asistencia', '% Asistencia', 'Convertidos', 'Total']],
            body: reportData.map(row => [
                row.districtName,
                row.activeMembers,
                row.attendance,
                `${row.percentage}%`,
                row.conversions,
                row.total
            ]),
            styles: {
                fontSize: 10,
                cellPadding: 4,
            },
            headStyles: {
                fillColor: [19, 109, 236], // Primary Blue
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            }
        });

        // Footer Summary
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        const grandTotal = reportData.reduce((sum, row) => sum + row.total, 0);

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total General de Asistentes: ${grandTotal}`, 14, finalY);
        doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, finalY + 6);

        doc.save(`Reporte_${eventName.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface-dark w-full max-w-4xl rounded-2xl border border-border-dark shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border-dark flex justify-between items-center bg-[#111822]">
                    <div>
                        <h2 className="text-white text-xl font-bold">Reporte de Evento</h2>
                        <p className="text-text-secondary text-sm">{eventName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-text-secondary">
                            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                            Generando reporte...
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-border-dark">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#111822] text-text-secondary text-xs uppercase font-bold tracking-wider">
                                        <th className="p-4 border-b border-border-dark">Distrito</th>
                                        <th className="p-4 border-b border-border-dark text-center">Miembros Activos</th>
                                        <th className="p-4 border-b border-border-dark text-center">Asistentes</th>
                                        <th className="p-4 border-b border-border-dark text-center">% Asistencia</th>
                                        <th className="p-4 border-b border-border-dark text-center">Convertidos</th>
                                        <th className="p-4 border-b border-border-dark text-center text-white">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark">
                                    {reportData.map((row) => (
                                        <tr key={row.districtId} className="hover:bg-white/5 transition-colors text-sm text-gray-300">
                                            <td className="p-4 font-medium text-white">{row.districtName}</td>
                                            <td className="p-4 text-center">{row.activeMembers}</td>
                                            <td className="p-4 text-center">{row.attendance}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${row.percentage >= 50 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                    {row.percentage}%
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">{row.conversions}</td>
                                            <td className="p-4 text-center font-bold text-white bg-white/5">{row.total}</td>
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-text-secondary">
                                                No hay datos disponibles para este reporte.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-[#111822] text-white font-bold text-sm">
                                    <tr>
                                        <td className="p-4">TOTALES</td>
                                        <td className="p-4 text-center">{reportData.reduce((Sum, r) => Sum + r.activeMembers, 0)}</td>
                                        <td className="p-4 text-center">{reportData.reduce((Sum, r) => Sum + r.attendance, 0)}</td>
                                        <td className="p-4 text-center">-</td>
                                        <td className="p-4 text-center">{reportData.reduce((Sum, r) => Sum + r.conversions, 0)}</td>
                                        <td className="p-4 text-center text-primary text-base">{reportData.reduce((Sum, r) => Sum + r.total, 0)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border-dark bg-[#111822] flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-text-secondary font-bold hover:text-white transition-colors">
                        Cerrar
                    </button>
                    <button
                        onClick={exportPDF}
                        disabled={loading || reportData.length === 0}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">picture_as_pdf</span>
                        Exportar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

const EventsScreen: React.FC = () => {
    const { events, loading, addEvent, updateEvent, deleteEvent, refreshEvents } = useEvents();
    const { showNotification } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        refreshEvents();
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Report State
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [currentReportEvent, setCurrentReportEvent] = useState({ id: '', name: '' });
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [reportLoading, setReportLoading] = useState(false);

    const handleOpenReport = async (event: any) => {
        setCurrentReportEvent({ id: event.id, name: event.name });
        setReportModalOpen(true);
        setReportLoading(true);
        try {
            const data = await api.get(`/events/${event.id}/report`);
            setReportData(data);
        } catch (error) {
            console.error(error);
            showNotification('Error al cargar reporte', 'error');
        } finally {
            setReportLoading(false);
        }
    };

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        image_url: '',
        active: true
    });

    const handleOpenModal = (event?: any) => {
        if (event) {
            setEditingEvent(event);
            setFormData({
                name: event.name,
                description: event.description || '',
                date: event.date,
                image_url: event.image_url || '',
                active: event.active !== 0
            });
        } else {
            setEditingEvent(null);
            setFormData({
                name: '',
                description: '',
                date: new Date().toISOString().split('T')[0],
                image_url: '',
                active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEvent(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, formData);
            } else {
                await addEvent(formData);
            }
            handleCloseModal();
        } catch (error) {
            // notification handled in context
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('¿Estás seguro de eliminar este evento?')) {
            await deleteEvent(id);
        }
    };

    const filteredEvents = events.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout title="Gestión de Eventos">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-8 pb-20">

                {/* Header Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">search</span>
                        <input
                            type="text"
                            placeholder="Buscar eventos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#111822] border border-border-dark rounded-xl py-3 pl-10 pr-4 text-white placeholder-text-secondary focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center gap-2 group w-full md:w-auto justify-center"
                    >
                        <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">add</span>
                        Nuevo Evento
                    </button>
                </div>

                {/* Events Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => (
                        <div key={event.id} onClick={() => handleOpenReport(event)} className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-lg group hover:border-primary/50 transition-all flex flex-col">
                            {/* Image */}
                            <div className="h-48 w-full bg-[#111822] relative overflow-hidden">
                                {event.image_url ? (
                                    <img src={event.image_url} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-6xl text-text-secondary opacity-20">event</span>
                                    </div>
                                )}
                                <div className="absolute top-4 right-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${event.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                        {event.active ? 'Activo' : 'Finalizado'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col flex-1">
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white mb-2 leading-tight">{event.name}</h3>
                                    <div className="flex items-center gap-2 mb-4 text-text-secondary">
                                        <span className="material-symbols-outlined text-base">calendar_month</span>
                                        <span className="text-xs font-bold uppercase tracking-wide">
                                            {new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="text-text-secondary text-sm line-clamp-3 mb-6">{event.description}</p>
                                </div>

                                {/* Metrics Cards */}
                                <div className="grid grid-cols-3 gap-2 mb-6">
                                    <div className="bg-[#111822] p-3 rounded-xl border border-border-dark">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-blue-400 text-lg">groups</span>
                                            <span className="text-[10px] text-text-secondary uppercase font-bold">Asistencias</span>
                                        </div>
                                        <p className="text-2xl font-black text-white">{event.attendance_count || 0}</p>
                                    </div>
                                    <div className="bg-[#111822] p-3 rounded-xl border border-border-dark flex flex-col justify-between">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-emerald-400 text-lg">how_to_reg</span>
                                            <span className="text-[9px] text-text-secondary uppercase font-bold truncate">Conversiones</span>
                                        </div>
                                        <p className="text-xl font-black text-white">{event.conversion_count || 0}</p>
                                    </div>
                                    <div className="bg-[#111822] p-3 rounded-xl border border-border-dark flex flex-col justify-between">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-orange-400 text-lg">functions</span>
                                            <span className="text-[9px] text-text-secondary uppercase font-bold truncate">Total Evento</span>
                                        </div>
                                        <p className="text-xl font-black text-white">{(event.attendance_count || 0) + (event.conversion_count || 0)}</p>
                                    </div>
                                    {/* Stats Calculation helper */}
                                    {(() => {
                                        const conv = Number(event.conversion_count) || 0;
                                        const ret = Number(event.retention_count) || 0;
                                        const effectiveness = conv > 0 ? Math.round((ret / conv) * 100) : 0;

                                        return (
                                            <div className="col-span-3 bg-[#111822] p-3 rounded-xl border border-border-dark flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                                                        <span className="material-symbols-outlined text-xl">trending_up</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-text-secondary uppercase font-bold">Efectividad de Retención</p>
                                                        <p className="text-[10px] text-text-secondary">({ret} de {conv} activos)</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-3xl font-black text-white">{effectiveness}%</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="flex justify-end gap-2 border-t border-border-dark pt-4">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(event); }}
                                        className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors"
                                    >
                                        <span className="material-symbols-outlined font-bold">edit</span>
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(event.id, e)}
                                        className="p-2 hover:bg-red-500/20 rounded-lg text-text-secondary hover:text-red-400 transition-colors"
                                    >
                                        <span className="material-symbols-outlined font-bold">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-surface-dark w-full max-w-lg rounded-3xl border border-border-dark shadow-2xl overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border-dark bg-[#111822] flex justify-between items-center">
                            <h2 className="text-white text-xl font-black">{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-text-secondary text-xs font-bold uppercase tracking-widest mb-2">Nombre del Evento</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-text-secondary text-xs font-bold uppercase tracking-widest mb-2">Fecha</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-text-secondary text-xs font-bold uppercase tracking-widest mb-2">Estado</label>
                                    <select
                                        value={formData.active ? '1' : '0'}
                                        onChange={e => setFormData({ ...formData, active: e.target.value === '1' })}
                                        className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="1">Activo</option>
                                        <option value="0">Finalizado</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-text-secondary text-xs font-bold uppercase tracking-widest mb-2">Imagen del Evento</label>

                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.image_url}
                                            onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                            placeholder="URL de imagen o Subir archivo..."
                                            className="flex-1 bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('event-image-upload')?.click()}
                                            className="bg-surface-dark border border-border-dark hover:bg-border-dark text-white px-4 rounded-xl flex items-center justify-center transition-colors"
                                            title="Subir imagen desde dispositivo"
                                        >
                                            <span className="material-symbols-outlined">upload_file</span>
                                        </button>
                                        <input
                                            type="file"
                                            id="event-image-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    // Limit to 800KB to save space
                                                    if (file.size > 800 * 1024) {
                                                        showNotification('La imagen es muy pesada. Máximo 800KB.', 'error');
                                                        return;
                                                    }
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setFormData(prev => ({ ...prev, image_url: reader.result as string }));
                                                        showNotification('Imagen cargada correctamente', 'success');
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-text-secondary">* Máximo 800KB por imagen para optimizar espacio.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-text-secondary text-xs font-bold uppercase tracking-widest mb-2">Descripción</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none resize-none"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl border border-border-dark text-white font-bold hover:bg-border-dark transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all">
                                    {editingEvent ? 'Guardar Cambios' : 'Crear Evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Report Modal */}
            <EventReportModal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                eventName={currentReportEvent.name}
                reportData={reportData}
                loading={reportLoading}
            />
        </Layout>
    );
};

export default EventsScreen;
