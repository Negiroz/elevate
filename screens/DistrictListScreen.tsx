
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useDistricts } from '../DistrictContext';
import { useUsers } from '../UserContext';
import { UserRole } from '../types';

const DistrictListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { districts, deleteDistrict } = useDistricts();
  const { users, user } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  const filteredDistricts = districts.filter(d => {
    // RBAC: District Supervisor only sees their own district
    if (user?.role === UserRole.DISTRICT_SUPERVISOR) {
      if (d.id !== user.districtId) return false;
    }

    const supervisor = users.find(u => u.id === d.supervisorId);
    const supervisorName = supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : 'Sin supervisor';

    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supervisorName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'Todos' ||
      (statusFilter === 'Activos' && d.active) ||
      (statusFilter === 'Inactivos' && !d.active);

    return matchesSearch && matchesStatus;
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmingId === id) {
      deleteDistrict(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  };

  const getSupervisorName = (id: string) => {
    const user = users.find(u => u.id === id);
    return user ? `${user.firstName} ${user.lastName}` : 'No asignado';
  };

  const handleViewCells = (districtName: string) => {
    // Pasamos el nombre completo ya que el filtro de células espera el nombre exacto del distrito
    navigate('/cells', { state: { initialFilter: districtName } });
  };

  return (
    <Layout title="Gestión de Distritos">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Distritos</h1>
            <p className="text-text-secondary text-sm">Organización territorial de la red de células.</p>
          </div>
          <button
            onClick={() => navigate('/districts/create')}
            className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-600 transition-all"
          >
            <span className="material-symbols-outlined">add_location</span> Nuevo Distrito
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-surface-dark p-4 rounded-xl flex flex-wrap gap-4 border border-border-dark shadow-sm">
          <div className="relative flex-1 min-w-[280px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">search</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111822] text-white border-border-dark rounded-lg pl-10 pr-4 py-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Buscar por nombre de distrito o supervisor..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#111822] text-white border-border-dark rounded-lg px-4 py-2 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[160px]"
          >
            <option value="Todos">Todos los estados</option>
            <option value="Activos">Activos</option>
            <option value="Inactivos">Inactivos</option>
          </select>
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDistricts.map((d) => (
            <div
              key={d.id}
              className="bg-surface-dark p-6 rounded-2xl border border-border-dark hover:border-primary/50 transition-all group relative shadow-lg"
            >
              <div className="absolute top-4 right-4 flex gap-1">
                <button
                  onClick={() => navigate(`/districts/edit/${d.id}`)}
                  className="p-1.5 text-text-secondary hover:text-white rounded-lg hover:bg-white/5"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  onClick={(e) => handleDelete(e, d.id)}
                  className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${confirmingId === d.id ? 'bg-red-600 text-white px-3' : 'text-text-secondary hover:text-red-400 hover:bg-red-500/5'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {confirmingId === d.id ? 'warning' : 'delete'}
                  </span>
                  {confirmingId === d.id && <span className="text-[10px] font-bold uppercase">Confirmar</span>}
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div
                  className="p-4 rounded-2xl shadow-inner"
                  style={{
                    backgroundColor: `${d.color || '#3B82F6'}20`,
                    color: d.color || '#3B82F6'
                  }}
                >
                  <span className="material-symbols-outlined text-3xl">location_on</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl">{d.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${d.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${d.active ? 'text-green-500' : 'text-red-500'}`}>
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-border-dark/50">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Supervisor</span>
                  <span className="text-white text-sm font-medium">{getSupervisorName(d.supervisorId)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Células Totales</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg font-bold">{d.cellCount}</span>
                    <span className="text-primary material-symbols-outlined text-[18px]">groups</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleViewCells(d.name)}
                className="w-full mt-6 py-2.5 bg-[#111822] rounded-xl text-primary text-sm font-bold border border-transparent hover:border-primary/30 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                Ver Detalles de Células
              </button>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredDistricts.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4 bg-surface-dark rounded-3xl border border-dashed border-border-dark">
            <span className="material-symbols-outlined text-6xl text-text-secondary opacity-20">map</span>
            <p className="text-text-secondary font-medium">No se encontraron distritos con los filtros actuales.</p>
            {(searchTerm || statusFilter !== 'Todos') && (
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('Todos'); }}
                className="text-primary font-bold hover:underline"
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DistrictListScreen;
