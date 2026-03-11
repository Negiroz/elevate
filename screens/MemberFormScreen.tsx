
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { UserRole } from '../types';
import { useUsers } from '../UserContext';
import { useDistricts } from '../DistrictContext';
import { useCells } from '../CellContext';
import { useConsolidation } from '../ConsolidationContext';
import { useEvents } from '../EventContext';

interface MemberFormScreenProps {
  mode: 'create' | 'edit';
}

const MemberFormScreen: React.FC<MemberFormScreenProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isConsolidationSource = searchParams.get('source') === 'consolidation';

  const { users, user, addUser, updateUser } = useUsers(); // Get 'user'
  const { addTask, updateTask, tasks, stages, refreshTasks } = useConsolidation();
  const { districts } = useDistricts();
  const { cells } = useCells();
  const { events } = useEvents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.MEMBER,
    active: true,
    imageUrl: '',
    districtId: user?.role === UserRole.LEADER ? user.districtId || '' : '',
    cellId: user?.role === UserRole.LEADER ? user.cellId || '' : '',
    birthDate: '',
    maritalStatus: '',
    gender: '',
    profession: '',
    address: '',
    phone: '',
    consolidationStageId: '',
    conversionOrigin: 'service', // Default to service
    conversionEventId: ''
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      if (isConsolidationSource) {
        const task = tasks.find(t => t.id === id);
        if (task) {
          // Attempt to parse metadata from notes if formatted as stored
          const notes = task.notes || '';
          const emailMatch = notes.match(/Email: (.*?)(?:\.|$)/);
          const profMatch = notes.match(/Profesión: (.*?)(?:\.|$)/);
          const maritalMatch = notes.match(/Estado Civil: (.*?)(?:\.|$)/);

          const names = task.name.split(' ');
          const lName = names.length > 1 ? names.pop() : '';
          const fName = names.join(' ');

          setFormData({
            firstName: fName,
            lastName: lName || '',
            email: emailMatch ? emailMatch[1] : '',
            role: UserRole.VISITOR, // Default for candidate
            active: task.active !== false,
            imageUrl: '',
            districtId: task.districtId || '',
            cellId: task.cellId || '',
            birthDate: task.birthDate || '',
            maritalStatus: maritalMatch ? maritalMatch[1] : '',
            gender: task.gender || '',
            profession: profMatch ? profMatch[1] : '',
            address: task.address || '',
            phone: task.phone || '',
            consolidationStageId: task.stage || '',
            conversionOrigin: 'service', // Default for now until task supports it
            conversionEventId: ''
          });
        }
      } else {
        const user = users.find(u => u.id === id);
        if (user) {
          setFormData({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            active: user.active,
            imageUrl: user.imageUrl || `https://picsum.photos/seed/${id}/200/200`,
            districtId: user.districtId || '',
            cellId: user.cellId || '',
            birthDate: user.birthDate || '',
            maritalStatus: user.maritalStatus || '',
            gender: user.gender || '',
            profession: user.profession || '',
            address: user.address || '',
            phone: user.phone || '',
            consolidationStageId: user.consolidationStageId || '',
            conversionOrigin: user.conversionOrigin || 'service',
            conversionEventId: user.conversionEventId || ''
          });
        }
      }
    }
  }, [mode, id, users, tasks, isConsolidationSource]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredCells = cells.filter(c => {
    if (!formData.districtId) return false;
    // Manejar casos donde districtId puede ser un nombre o un ID real
    const district = districts.find(d => d.id === formData.districtId);
    return c.districtId === formData.districtId || (district && c.districtId === district.name.replace('Distrito ', ''));
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isConsolidationSource) {
      const taskData = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        districtId: formData.districtId || undefined,
        cellId: formData.cellId || undefined,
        gender: formData.gender as any,
        active: formData.active,
        notes: `Profesión: ${formData.profession || 'N/A'}. Estado Civil: ${formData.maritalStatus || 'N/A'}. Email: ${formData.email || 'N/A'}`,
        birthDate: formData.birthDate,
        address: formData.address,
        stage: formData.consolidationStageId || (stages.length > 0 ? stages[0].id : ''),
        conversionOrigin: formData.conversionOrigin,
        conversionEventId: formData.conversionEventId
      };

      if (mode === 'create') {
        await addTask({
          ...taskData,
          progress: 0,
          visitDate: new Date().toISOString()
        });
      } else if (id && mode === 'edit') {
        await updateTask(id, taskData);
      }

      navigate('/consolidation');
      return;
    }

    if (mode === 'create') {
      console.log("Submitting New Member:", formData);
      await addUser(formData);
      // Logic refactored: Consolidation Board reads directly from profiles with stage_id
      // No need to create separate task
    } else if (id) {
      await updateUser(id, formData);
      refreshTasks().catch(console.error); // Sync consolidation board
    }
    navigate('/members');
  };

  const getPageTitle = () => {
    if (isConsolidationSource) return 'Nuevo Candidato';
    return mode === 'create' ? 'Inscribir Persona' : 'Editar Ficha';
  };

  const getHeaderTitle = () => {
    if (isConsolidationSource) return 'Ficha de Candidato';
    return mode === 'create' ? 'Ficha de Nuevo Miembro' : 'Actualizar Miembro';
  };

  return (
    <Layout title={getHeaderTitle()}>
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(isConsolidationSource ? '/consolidation' : '/members')} className="p-2 text-text-secondary hover:text-white rounded-lg bg-surface-dark border border-border-dark">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-black text-white">{getPageTitle()}</h1>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

        <div className="bg-surface-dark rounded-2xl border border-border-dark p-6 mb-8 flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="relative group cursor-pointer" onClick={handleImageClick}>
            <img
              src={formData.imageUrl || `https://picsum.photos/seed/new_mbr/200/200`}
              className="size-28 rounded-full border-4 border-background-dark object-cover group-hover:opacity-40 transition-all shadow-2xl"
              alt="Profile"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-white text-4xl">add_a_photo</span>
            </div>
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black text-white">
              {formData.firstName || formData.lastName ? `${formData.firstName} ${formData.lastName}` : 'Datos del Miembro'}
            </h2>
            <p className="text-text-secondary text-sm mb-3">{formData.email || 'No asignado'}</p>
            <span className="bg-primary/10 text-primary text-[10px] font-black uppercase px-3 py-1 rounded-full border border-primary/20 tracking-widest">
              Categoría: {isConsolidationSource ? 'CANDIDATO' : formData.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-dark rounded-2xl border border-border-dark p-8 space-y-8 shadow-2xl">
          <div>
            <h3 className="text-primary font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">person</span> Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Nombre</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Ej: David"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Apellido</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Ej: Cohen"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Correo Electrónico (Opcional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Opcional"
                />
              </div>

              {/* Moved Personal Data Fields */}
              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={formData.birthDate || ''}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Estado Civil</label>
                <select
                  value={formData.maritalStatus || ''}
                  onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Soltero/a">Soltero/a</option>
                  <option value="Casado/a">Casado/a</option>
                  <option value="Concubino/a">Concubino/a</option>
                  <option value="Viudo/a">Viudo/a</option>
                  <option value="Divorciado/a">Divorciado/a</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Género</label>
                <select
                  value={formData.gender || ''}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Profesión / Ocupación</label>
                <input
                  type="text"
                  value={formData.profession || ''}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Ej. Abogado, Estudiante..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Dirección</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Calle, Número, Ciudad"
                />
              </div>

              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  placeholder="+54 9 11..."
                />
              </div>



            </div>
          </div>

          <div className="pt-8 border-t border-border-dark/30">
            <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">account_tree</span> Información Eclesiástica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Asignar Distrito</label>
                <select
                  value={formData.districtId}
                  onChange={(e) => setFormData({ ...formData, districtId: e.target.value, cellId: '' })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={user?.role === UserRole.LEADER}
                >
                  <option value="">Ningún Distrito</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Asignar Célula</label>
                <select
                  value={formData.cellId}
                  onChange={(e) => setFormData({ ...formData, cellId: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!formData.districtId || user?.role === UserRole.LEADER}
                >
                  <option value="">Ninguna Célula</option>
                  {filteredCells.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Categoría</label>
                <select
                  value={isConsolidationSource ? UserRole.VISITOR : formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                  disabled={isConsolidationSource}
                >
                  {Object.values(UserRole)
                    .filter(role => role === UserRole.MEMBER || role === UserRole.VISITOR || role === UserRole.TIMOTEO)
                    .map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                </select>
              </div>



              <div className="space-y-2 flex flex-col justify-end pb-3">
                <div className="flex items-center gap-3 bg-[#111822] border border-border-dark p-3.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-5 h-5 rounded text-primary focus:ring-primary bg-surface-dark border-border-dark"
                  />
                  <span className="text-white text-sm font-bold uppercase tracking-tighter">Estado de Actividad</span>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Etapa de Consolidación</label>
                <select
                  value={formData.consolidationStageId || ''}
                  onChange={(e) => setFormData({ ...formData, consolidationStageId: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                >
                  <option value="">Seleccionar Etapa...</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {/* Conversion Details Section */}
              <div className="space-y-2 md:col-span-2 border-t border-border-dark/30 pt-4 mt-2">
                <h4 className="text-white text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">how_to_reg</span> Detalles de Conversión
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Origen de Conversión</label>
                    <select
                      value={formData.conversionOrigin}
                      onChange={(e) => setFormData({ ...formData, conversionOrigin: e.target.value, conversionEventId: '' })}
                      className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                    >
                      <option value="service">Servicio General</option>
                      <option value="cell">Reunión de Célula</option>
                      <option value="event">Evento</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>

                  {formData.conversionOrigin === 'event' && (
                    <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                      <label className="text-white text-xs font-black uppercase tracking-widest ml-1">Seleccionar Evento</label>
                      <select
                        value={formData.conversionEventId}
                        onChange={(e) => setFormData({ ...formData, conversionEventId: e.target.value })}
                        className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary transition-all"
                        required={formData.conversionOrigin === 'event'}
                      >
                        <option value="">-- Seleccionar Evento --</option>
                        {/* Active events first, then others. Showing ALL relevant events instead of slicing to 10. */}
                        {events
                          .filter(e => e.active || e.id === formData.conversionEventId) // Show active or currently selected
                          .map(e => (
                            <option key={e.id} value={e.id}>
                              {e.name} ({new Date(e.date + 'T00:00:00').toLocaleDateString()}) {!e.active ? '(Inactivo)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-border-dark/50">
            <button
              onClick={() => navigate(isConsolidationSource ? '/consolidation' : '/members')}
              type="button"
              className="px-6 py-3 text-text-secondary hover:text-white font-bold transition-colors"
            >
              Cerrar sin guardar
            </button>
            <button
              type="submit"
              className="bg-primary hover:bg-blue-600 px-12 py-3 rounded-xl text-white font-black shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              {isConsolidationSource ? 'Guardar Candidato' : (mode === 'create' ? 'Inscribir Miembro' : 'Guardar Ficha')}
            </button>
          </div>
        </form >
      </div >
    </Layout >
  );
};

export default MemberFormScreen;
