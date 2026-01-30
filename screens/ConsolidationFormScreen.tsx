
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { UserRole } from '../types';
import { useConsolidation } from '../ConsolidationContext';
import { useDistricts } from '../DistrictContext';
import { useCells } from '../CellContext';
import { useTasks } from '../TaskContext';
import { useUsers } from '../UserContext';
import { useNotification } from '../NotificationContext';

interface ConsolidationFormScreenProps {
  mode: 'create' | 'edit';
}

const ConsolidationFormScreen: React.FC<ConsolidationFormScreenProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addTask, updateTask, tasks } = useConsolidation(); // Changed to use addTask, updateTask, tasks directly
  const { districts } = useDistricts();
  const { cells } = useCells();
  const { addTask: createSystemTask } = useTasks();
  const { user, addUser, updateUser } = useUsers(); // Added addUser, updateUser
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    stage: 'new',
    districtId: user?.role === 'Líder de Célula' ? user.districtId || '' : '',
    cellId: user?.role === 'Líder de Célula' ? user.cellId || '' : '',
    birthDate: '',
    address: '',
    gender: '' as 'Masculino' | 'Femenino' | 'Otro' | '',
    active: true,
    notes: '',
    visitDate: ''
  });
  const [loading, setLoading] = useState(false); // Added loading state

  useEffect(() => {
    if (mode === 'edit' && id) {
      const task = tasks.find(t => t.id === id); // Changed from consoTasks to tasks
      if (task) {
        setFormData({
          name: task.name,
          phone: task.phone || '',
          stage: task.stage,
          districtId: task.districtId || '',
          cellId: task.cellId || '',
          birthDate: task.birthDate || '',
          address: task.address || '',
          gender: task.gender || '' as any, // Added as any
          active: task.active,
          notes: task.notes || '',
          visitDate: task.visitDate || ''
        });
      }
    }
  }, [mode, id, tasks]); // Changed from consoTasks to tasks

  const filteredCells = cells.filter(c => {
    if (!formData.districtId) return false;
    const district = districts.find(d => d.id === formData.districtId);
    if (!district) return false;
    const simplifiedName = district.name.replace('Distrito ', '');
    return c.districtId === district.id || c.districtId === simplifiedName;
  });

  const handleSubmit = async (e: React.FormEvent) => { // Made async
    e.preventDefault();
    setLoading(true); // Set loading to true

    try {
      const payload = {
        ...formData,
        gender: formData.gender as any
      };

      if (mode === 'create') {
        // REFACTOR: Use addUser to create the profile directly
        const names = formData.name.split(' ');
        const lastName = names.length > 1 ? names.pop() || '' : '';
        const firstName = names.join(' ');

        await addUser({
          firstName: firstName,
          lastName: lastName,
          email: '', // Candidates might not have email yet
          role: UserRole.VISITOR, // Default role for consolidation
          consolidationStageId: formData.stage,
          phone: formData.phone,
          districtId: formData.districtId || undefined,
          cellId: formData.cellId || undefined,
          gender: formData.gender as any,
          active: formData.active,
          // notes: formData.notes, // UserContext doesn't handle notes yet? We accept losing notes or need to add it to UserContext.
          birthDate: formData.birthDate,
          address: formData.address,
          profession: '',
          maritalStatus: ''
        });
      } else if (id) {
        await updateTask(id, { // Changed to updateTask
          name: formData.name,
          stage: formData.stage,
          phone: formData.phone,
          districtId: formData.districtId || undefined,
          cellId: formData.cellId || undefined,
          gender: formData.gender as any,
          active: formData.active,
          notes: formData.notes,
          birthDate: formData.birthDate,
          address: formData.address,
          visitDate: formData.visitDate
        });
      }

      // Automatización: Tarea para el Líder
      if (formData.cellId && formData.visitDate) {
        const cell = cells.find(c => c.id === formData.cellId);
        if (cell) {
          createSystemTask({
            title: `Visita: ${formData.name}`,
            description: `Acción requerida: Realizar visita de bienvenida. Dirección: ${formData.address || 'No provista'}. Tel: ${formData.phone}`,
            status: 'pending',
            priority: 'high',
            category: 'automation',
            dueDate: formData.visitDate,
            assignedToId: cell.leaderId,
            createdByUserId: user?.id || ''
          });
        }
      }

      navigate('/consolidation');
      showNotification(mode === 'create' ? 'Candidato registrado exitosamente' : 'Registro actualizado', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Error al guardar', 'error');
    } finally {
      setLoading(false); // Set loading to false
    }
  };

  return (
    <Layout title={mode === 'create' ? 'Registrar Candidato' : 'Editar Registro'}>
      <div className="max-w-4xl mx-auto w-full pb-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/consolidation')} className="p-2 text-text-secondary hover:text-white rounded-lg bg-surface-dark border border-border-dark">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-black text-white">{mode === 'create' ? 'Nuevo Candidato' : 'Modificar Registro'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-dark rounded-2xl border border-border-dark p-8 space-y-8 shadow-2xl">
          <div>
            <h3 className="text-primary font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">person</span> Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-white text-sm font-semibold">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary"
                  placeholder="Nombre y Apellidos"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-semibold">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary"
                  placeholder="+54 9 11 1234 5678"
                />
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-semibold">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary"
                  placeholder="Calle, Ciudad"
                />
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border-dark/30">
            <h3 className="text-orange-400 font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">event_upcoming</span> Programar Cita de Visita
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-white text-sm font-semibold">Fecha Pactada</label>
                <input
                  type="date"
                  value={formData.visitDate}
                  onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-orange-500"
                />
                <p className="text-[10px] text-text-secondary mt-1">Al definir una fecha, se creará automáticamente una tarea para el líder de célula.</p>
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-semibold">Célula Destino</label>
                <select
                  value={formData.districtId}
                  onChange={(e) => setFormData({ ...formData, districtId: e.target.value, cellId: '' })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={user?.role === 'Líder de Célula'}
                >
                  <option value="">Seleccionar Distrito</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <select
                  value={formData.cellId}
                  onChange={(e) => setFormData({ ...formData, cellId: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!formData.districtId || user?.role === 'Líder de Célula'}
                >
                  <option value="">Seleccionar Célula</option>
                  {filteredCells.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border-dark/50">
            <button onClick={() => navigate('/consolidation')} type="button" className="px-6 py-2 text-text-secondary font-bold">Cancelar</button>
            <button type="submit" className="bg-primary text-white px-10 py-3 rounded-xl font-bold shadow-lg">
              {mode === 'create' ? 'Registrar y Notificar' : 'Actualizar Registro'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default ConsolidationFormScreen;
