
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { useDistricts } from '../DistrictContext';
import { useUsers } from '../UserContext';
import { UserRole } from '../types';

interface DistrictFormScreenProps {
  mode: 'create' | 'edit';
}

const DistrictFormScreen: React.FC<DistrictFormScreenProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { districts, addDistrict, updateDistrict } = useDistricts();
  const { users } = useUsers();

  const [formData, setFormData] = useState({
    name: '',
    supervisorId: '',
    active: true,
    color: '#3B82F6'
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      const district = districts.find(d => d.id === id);
      if (district) {
        setFormData({
          name: district.name,
          supervisorId: district.supervisorId,
          active: district.active,
          color: district.color || '#3B82F6'
        });
      }
    }
  }, [mode, id, districts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      addDistrict(formData);
    } else if (id) {
      updateDistrict(id, formData);
    }
    navigate('/districts');
  };

  // Filtrar solo usuarios con rol de Supervisor de Distrito
  const supervisors = users.filter(u => u.role === UserRole.DISTRICT_SUPERVISOR);

  return (
    <Layout title={mode === 'create' ? 'Nuevo Distrito' : 'Editar Distrito'}>
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/districts')} className="p-2 text-text-secondary hover:text-white rounded-lg bg-surface-dark border border-border-dark">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-black text-white">{mode === 'create' ? 'Crear Nuevo Distrito' : 'Modificar Distrito'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-dark rounded-xl border border-border-dark p-8 space-y-8 shadow-2xl">
          <div className="flex flex-col items-center justify-center pb-4 border-b border-border-dark/30 mb-4">
            <div className="p-5 bg-primary/10 text-primary rounded-full mb-4">
              <span className="material-symbols-outlined text-5xl">location_on</span>
            </div>
            <p className="text-text-secondary text-sm text-center max-w-sm">Define un área geográfica o sector ministerial para organizar el crecimiento de tus células.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2 md:col-span-2">
              <label className="text-white text-sm font-semibold ml-1">Nombre del Distrito</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Ej: Distrito Centro-Norte"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-white text-sm font-semibold ml-1">Supervisor de Distrito</label>
              <select
                value={formData.supervisorId}
                onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              >
                <option value="">Seleccionar Supervisor</option>
                {supervisors.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-white text-sm font-semibold ml-1">Color Identificativo</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-12 w-20 bg-[#111822] border border-border-dark rounded-xl p-1 cursor-pointer"
                />
                <div className="text-text-secondary text-sm">
                  <p>Color del distrito en mapas y gráficos.</p>
                  <p className="text-xs opacity-50 uppercase">{formData.color}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 flex flex-col justify-end pb-3">
              <div className="flex items-center gap-3 bg-[#111822] border border-border-dark p-3.5 rounded-xl">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 rounded text-primary focus:ring-primary bg-surface-dark border-border-dark"
                />
                <span className="text-white text-sm font-medium">Distrito Operativo</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-border-dark">
            <button
              onClick={() => navigate('/districts')}
              type="button"
              className="px-6 py-3 text-text-secondary hover:text-white font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-primary hover:bg-blue-600 px-10 py-3 rounded-xl text-white font-bold shadow-lg shadow-primary/20 transition-all"
            >
              {mode === 'create' ? 'Crear Distrito' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default DistrictFormScreen;
