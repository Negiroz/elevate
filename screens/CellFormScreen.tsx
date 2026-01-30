
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { useCells } from '../CellContext';
import { useDistricts } from '../DistrictContext';
import { useUsers } from '../UserContext';
import { UserRole } from '../types';

interface CellFormScreenProps {
  mode: 'create' | 'edit';
}

const CellFormScreen: React.FC<CellFormScreenProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { cells, addCell, updateCell } = useCells();
  const { districts } = useDistricts();
  const { users } = useUsers();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    leaderId: '',
    districtId: '',
    memberCount: 0,
    imageUrl: '',
    meetingDay: ''
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      const cell = cells.find(c => c.id === id);
      if (cell) {
        setFormData({
          name: cell.name,
          leaderId: cell.leaderId,
          districtId: cell.districtId,
          memberCount: cell.memberCount,
          imageUrl: cell.imageUrl || '',
          meetingDay: cell.meetingDay || ''
        });
      }
    }
  }, [mode, id, cells]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      addCell(formData);
    } else if (id) {
      updateCell(id, formData);
    }
    navigate('/cells');
  };

  // Filtrar líderes de célula
  const filteredLeaders = users.filter(u => u.role === UserRole.LEADER);
  // Filtrar solo distritos activos
  const activeDistricts = districts.filter(d => d.active);

  return (
    <Layout title={mode === 'create' ? 'Nueva Célula' : 'Editar Célula'}>
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/cells')} className="p-2 text-text-secondary hover:text-white rounded-lg bg-surface-dark border border-border-dark">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-black text-white">{mode === 'create' ? 'Crear Nueva Célula' : 'Modificar Célula'}</h1>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />

        <form onSubmit={handleSubmit} className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden shadow-2xl">
          <div
            className="h-48 bg-[#111822] relative cursor-pointer group flex items-center justify-center overflow-hidden"
            onClick={handleImageClick}
          >
            {formData.imageUrl ? (
              <>
                <img src={formData.imageUrl} className="w-full h-full object-cover group-hover:opacity-50 transition-all" alt="Header" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/60 p-4 rounded-full text-white flex flex-col items-center">
                    <span className="material-symbols-outlined text-3xl">photo_camera</span>
                    <span className="text-[10px] font-bold uppercase mt-1">Cambiar Foto</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-text-secondary group-hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-5xl">add_photo_alternate</span>
                <span className="font-bold">Subir imagen de portada</span>
              </div>
            )}
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 md:col-span-2">
                <label className="text-white text-sm font-semibold ml-1">Nombre de la Célula</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="Ej: Jóvenes con Propósito"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-semibold ml-1">Líder Asignado</label>
                <select
                  value={formData.leaderId}
                  onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                >
                  <option value="">Seleccionar Líder</option>
                  {filteredLeaders.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-semibold ml-1">Distrito</label>
                <select
                  value={formData.districtId}
                  onChange={(e) => setFormData({ ...formData, districtId: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                >
                  <option value="">Seleccionar Distrito</option>
                  {activeDistricts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-semibold ml-1">Día de Reunión</label>
                <select
                  value={formData.meetingDay}
                  onChange={(e) => setFormData({ ...formData, meetingDay: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                >
                  <option value="">Seleccionar Día</option>
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-border-dark">
              <button
                onClick={() => navigate('/cells')}
                type="button"
                className="px-6 py-3 text-text-secondary hover:text-white font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-primary hover:bg-blue-600 px-10 py-3 rounded-xl text-white font-bold shadow-lg shadow-primary/20 transition-all"
              >
                {mode === 'create' ? 'Crear Célula' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div >
    </Layout >
  );
};

export default CellFormScreen;
