import React, { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUsers } from '../UserContext';
import { useCells } from '../CellContext';
import { useConsolidation } from '../ConsolidationContext';
import { api } from '../lib/api';
import { UserRole } from '../types';
import { useNotification } from '../NotificationContext';
import { useEvents } from '../EventContext';
import OfferingModal from '../components/OfferingModal';

const CellAttendanceScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { users } = useUsers();
  const { cells } = useCells();
  const { tasks } = useConsolidation();
  const { showNotification } = useNotification();

  // Estado para el tipo de actividad
  // Inicializar fecha desde URL o hoy
  const params = new URLSearchParams(location.search);
  const initialDate = params.get('date') || new Date().toLocaleDateString('en-CA');
  const initialType = (params.get('type') as any) || 'cell';

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activityType, setActivityType] = useState<'cell' | 'service' | 'event'>(initialType);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  // Missing State Definitions
  const { events } = useEvents();
  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [currentOffering, setCurrentOffering] = useState<any | null>(null);
  const [attendees, setAttendees] = useState<Record<string, boolean>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Derived State
  const currentCell = useMemo(() => cells.find(c => c.id === id), [cells, id]);

  const cellMembers = useMemo(() => {
    if (!currentCell) return [];
    return users.filter(u => u.cellId === currentCell.id);
  }, [users, currentCell]);

  const activeEvents = useMemo(() => events.filter(e => e.active), [events]);

  const presentCount = useMemo(() => Object.values(attendees).filter(Boolean).length, [attendees]);

  // Helper Functions
  const handleTypeChange = (type: 'cell' | 'service' | 'event') => {
    setActivityType(type);
    setIsSaved(false);
  };

  const toggleAttendee = (memberId: string) => {
    setAttendees(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
    setIsSaved(false);
  };

  React.useEffect(() => {
    // Solo actualizar si cambian los params y son diferentes al estado actual
    // Esto es para navegación interna, aunque la inicialización cubre la carga inicial
    const searchParams = new URLSearchParams(location.search);
    const dateParam = searchParams.get('date');
    if (dateParam && dateParam !== selectedDate) {
      setSelectedDate(dateParam);
    }

    const openOffering = searchParams.get('openOffering');
    if (openOffering === 'true') {
      setIsOfferingModalOpen(true);
    }

    const typeParam = searchParams.get('type');
    if (typeParam && ['cell', 'service', 'event'].includes(typeParam) && typeParam !== activityType) {
      setActivityType(typeParam as any);
    }
  }, [location.search]);

  const handleDateClick = () => {
    if (!isSaved && dateInputRef.current) {
      if ('showPicker' in dateInputRef.current) {
        (dateInputRef.current as any).showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };



  React.useEffect(() => {
    if (activityType === 'cell' && id && selectedDate) {
      fetchOfferingDetails();
    } else {
      setCurrentOffering(null);
    }
  }, [id, activityType, selectedDate]);

  // Cargar asistencia existente si la hay
  React.useEffect(() => {
    if (id && selectedDate) {
      fetchExistingAttendance();
    }
  }, [id, selectedDate, activityType]);

  const fetchExistingAttendance = async () => {
    console.log(`[DEBUG] Fetching attendance. Cell: ${id}, Date: ${selectedDate}, Type: ${activityType}`);
    try {
      const res = await api.get(`/attendance?cell_id=${id}&date=${selectedDate}&type=${activityType}`);
      console.log('[DEBUG] Attendance Response:', res);

      if (Array.isArray(res) && res.length > 0) {
        const newAttendees: Record<string, boolean> = {};
        res.forEach((record: any) => {
          if (record.status === 'present') {
            newAttendees[record.member_id] = true;
          }
        });
        console.log('[DEBUG] Setting attendees:', Object.keys(newAttendees).length);
        setAttendees(newAttendees);
        setIsSaved(false);
      } else {
        console.log('[DEBUG] No attendance records found (or empty array).');
        setAttendees({});
        setIsSaved(false);
      }
    } catch (error) {
      console.error("[DEBUG] Error fetching existing attendance:", error);
    }
  };

  const fetchOfferingDetails = async () => {
    try {
      const res = await api.get(`/offering/detail?cell_id=${id}&date=${selectedDate}`);
      if (res) {
        // Map backend fields to frontend state expected by modal
        setCurrentOffering({
          cashBs: res.cash_bs,
          cashUsd: res.cash_usd,
          transfer: res.transfer
        });
      } else {
        setCurrentOffering(null);
      }
    } catch (error) {
      // Silent error or log
      console.log("No offering detail found or error", error);
      setCurrentOffering(null);
    }
  };

  const handleSaveClick = () => {
    if (!id) return;
    if (activityType === 'event' && !selectedEventId) {
      showNotification('Por favor selecciona un evento', 'error');
      return;
    }

    if (activityType === 'cell') {
      setIsOfferingModalOpen(true);
    } else {
      submitAttendance();
    }
  };

  const submitAttendance = async (offeringData?: any) => {
    setIsSaving(true);

    try {
      const date = selectedDate;

      const attendanceRecords = cellMembers.map(member => ({
        member_id: member.id, // Unified ID (profile id)
        cell_id: id,
        date: date,
        status: attendees[member.id] ? 'present' : 'absent',
        type: activityType,
        event_id: activityType === 'event' ? selectedEventId : null
      }));

      const payload = {
        attendanceRecords,
        offering: offeringData ? {
          cell_id: id,
          date: date,
          cash_bs: offeringData.cashBs,
          cash_usd: offeringData.cashUsd,
          transfer: offeringData.transfer
        } : undefined
      };

      // Send to API (bulk upsert handled in route)
      await api.post('/attendance', payload);

      setIsSaved(true);

      setIsOfferingModalOpen(false);

      // Update local state to reflect saved data immediately
      if (offeringData) {
        setCurrentOffering({
          cashBs: offeringData.cashBs,
          cashUsd: offeringData.cashUsd,
          transfer: offeringData.transfer
        });
      }

      showNotification('Asistencia guardada correctamente', 'success');
      navigate('/reports', { state: { tab: 'attendance' } });
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      const msg = error.response?.data?.error || error.message || 'Error desconocido';
      showNotification(`Error al guardar la asistencia: ${msg}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout title="Control de Asistencia">
      <div className="max-w-4xl mx-auto w-full pb-10">

        {/* Activity Type Selector */}
        <div className="flex flex-col gap-6 mb-10 items-center">
          <div className="bg-[#111822] p-1.5 rounded-2xl border border-border-dark flex flex-wrap justify-center gap-1 shadow-2xl">
            <button
              onClick={() => handleTypeChange('cell')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all duration-300 ${activityType === 'cell'
                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                : 'text-text-secondary hover:text-white hover:bg-surface-dark'
                }`}
            >
              <span className="material-symbols-outlined">groups</span>
              Célula
            </button>
            <button
              onClick={() => handleTypeChange('service')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all duration-300 ${activityType === 'service'
                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                : 'text-text-secondary hover:text-white hover:bg-surface-dark'
                }`}
            >
              <span className="material-symbols-outlined">church</span>
              Servicio
            </button>
            <button
              onClick={() => handleTypeChange('event')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all duration-300 ${activityType === 'event'
                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                : 'text-text-secondary hover:text-white hover:bg-surface-dark'
                }`}
            >
              <span className="material-symbols-outlined">event</span>
              Evento
            </button>
          </div>

          {/* Event Selector Dropdown */}
          {activityType === 'event' && (
            <div className="w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="block text-text-secondary text-xs font-bold uppercase tracking-widest mb-2 text-center">Seleccionar Evento Activo</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none shadow-lg text-center font-bold"
              >
                <option value="">-- Seleccionar --</option>
                {activeEvents.map(event => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="relative mb-2">
              <div
                onClick={handleDateClick}
                className="flex items-center gap-2 bg-surface-dark border border-border-dark hover:border-primary/50 text-text-secondary hover:text-primary px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm group w-fit relative z-20">
                <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform text-primary">calendar_month</span>
                <span className="font-bold text-sm uppercase tracking-wider">
                  {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Seleccionar Fecha'}
                </span>
                <span className="material-symbols-outlined text-[16px] opacity-50">arrow_drop_down</span>
              </div>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => !isSaved && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                disabled={isSaved}
              />
            </div>
            <h1 className="text-3xl font-black text-white">
              {activityType === 'cell' ? 'Reporte de Célula' : activityType === 'service' ? 'Asistencia al Servicio' : 'Asistencia a Evento'}
            </h1>
            <p className="text-text-secondary text-sm">
              {currentCell?.name || 'Célula'} • {activityType === 'cell' ? 'Encuentro Semanal' : activityType === 'service' ? 'Culto de Adoración' : activeEvents.find(e => e.id === selectedEventId)?.name || 'Evento Especial'}
            </p>
          </div>

          <div className="bg-surface-dark border border-border-dark p-3.5 rounded-2xl flex gap-6 shadow-xl">
            <div className="text-center px-2">
              <p className="text-emerald-400 text-2xl font-black leading-none mb-1">{presentCount}</p>
            </div>
            <div className="w-px h-10 bg-border-dark self-center opacity-40"></div>
            <div className="text-center px-2">
              <p className="text-white text-2xl font-black leading-none mb-1">{cellMembers.length}</p>
              <p className="text-[10px] text-text-secondary uppercase font-black tracking-tighter">Total Grupo</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-dark rounded-3xl border border-border-dark overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-border-dark bg-[#111822] grid grid-cols-12 text-[10px] font-black text-text-secondary uppercase tracking-widest">
            <div className="col-span-8 px-2">Miembro / Rol</div>
            <div className="col-span-4 text-right px-4">Estado de Asistencia</div>
          </div>
          <div className="divide-y divide-border-dark/50">
            {cellMembers.map((m) => (
              <div
                key={m.id}
                onClick={() => !isSaved && toggleAttendee(m.id)}
                className={`grid grid-cols-12 p-5 items-center transition-all ${!isSaved ? 'cursor-pointer hover:bg-white/5' : ''} ${attendees[m.id] ? 'bg-primary/5' : ''
                  }`}
              >
                <div className="col-span-8 flex items-center gap-4">
                  <div className="relative">
                    <img src={m.imageUrl || `https://picsum.photos/seed/${m.id}/100/100`} className="size-14 rounded-2xl border-2 border-border-dark object-cover" alt="avatar" />
                    {attendees[m.id] && (
                      <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1 border-4 border-surface-dark shadow-lg">
                        <span className="material-symbols-outlined text-[14px] text-white font-black">check</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg leading-tight mb-0.5">{m.firstName} {m.lastName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary font-black uppercase tracking-widest">{m.role}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 flex justify-end px-2">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${attendees[m.id]
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[#111822] border-border-dark text-text-secondary'
                    }`}>
                    <span className="text-[11px] font-black uppercase tracking-widest">
                      {attendees[m.id] ? 'Presente' : 'Ausente'}
                    </span>
                    <div className={`w-3 h-3 rounded-full ${attendees[m.id] ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-slate-700'}`}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cellMembers.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-6xl text-text-secondary opacity-10">person_off</span>
              <p className="text-text-secondary font-bold">No hay miembros registrados en esta célula para tomar asistencia.</p>
              <button onClick={() => navigate('/members')} className="text-primary text-sm font-bold hover:underline">Ir a Fichero de Miembros</button>
            </div>
          )}
        </div>

        {/* Offering Summary Section (Only for Cell) */}
        {activityType === 'cell' && (
          <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-8xl text-emerald-500">payments</span>
            </div>

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">payments</span>
                  Reporte de Ofrendas
                </h3>
                <p className="text-text-secondary text-sm mt-1">Montos registrados para esta fecha.</p>
              </div>
              <button
                onClick={() => setIsOfferingModalOpen(true)}
                className="text-primary font-bold text-sm bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">{currentOffering ? 'edit' : 'add'}</span>
                {currentOffering ? 'Editar Montos' : 'Registrar Ofrenda'}
              </button>
            </div>

            {currentOffering ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                <div className="bg-[#111822] p-4 rounded-xl border border-border-dark">
                  <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-1">Efectivo (Bs)</p>
                  <p className="text-2xl font-black text-white">Bs {currentOffering.cashBs.toFixed(2)}</p>
                </div>
                <div className="bg-[#111822] p-4 rounded-xl border border-border-dark">
                  <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-1">Efectivo ($)</p>
                  <p className="text-2xl font-black text-white">$ {currentOffering.cashUsd.toFixed(2)}</p>
                </div>
                <div className="bg-[#111822] p-4 rounded-xl border border-border-dark">
                  <p className="text-text-secondary text-[10px] uppercase font-black tracking-widest mb-1">Transferencia</p>
                  <p className="text-2xl font-black text-white">Bs {currentOffering.transfer.toFixed(2)}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-[#111822] rounded-xl border border-border-dark text-center border-dashed">
                <p className="text-text-secondary font-medium">No se ha registrado ofrenda para esta fecha.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center mt-10 gap-6">
          <div className="flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 px-5 py-3 rounded-2xl max-w-md">
            <span className="material-symbols-outlined text-blue-400">info</span>
            <p className="text-text-secondary text-xs leading-relaxed">
              Este reporte de <strong>{activityType === 'cell' ? 'Célula' : 'Servicio'}</strong> impactará directamente en las métricas de fidelidad del miembro en su ficha personal.
            </p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={() => navigate('/cells')}
              className="flex-1 sm:flex-none px-8 py-4 bg-surface-dark border border-border-dark rounded-2xl text-white font-bold hover:bg-border-dark transition-all"
            >
              Volver
            </button>
            <button
              onClick={handleSaveClick}
              disabled={isSaving || isSaved}
              className={`flex-1 sm:flex-none px-12 py-4 rounded-2xl font-black shadow-2xl transition-all flex items-center justify-center gap-2 ${isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-900/40 cursor-default'
                : 'bg-primary text-white shadow-primary/40 hover:bg-blue-600 hover:-translate-y-1'
                } ${isSaving ? 'opacity-75 cursor-wait' : ''}`}
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Guardando...
                </>
              ) : isSaved ? (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  Asistencia Guardada
                </>
              ) : (
                'Guardar Asistencia'
              )}
            </button>
          </div>
        </div>
      </div>


      <OfferingModal
        isOpen={isOfferingModalOpen}
        onClose={() => setIsOfferingModalOpen(false)}
        onSave={submitAttendance}
        isSaving={isSaving}
      />
    </Layout >
  );
};

export default CellAttendanceScreen;
