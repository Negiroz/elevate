
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCells } from '../CellContext';
import { useDistricts } from '../DistrictContext';
import { useUsers } from '../UserContext';
import { useConsolidation } from '../ConsolidationContext';
import { UserRole } from '../types';

const CellListScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cells, deleteCell } = useCells();
  const { districts } = useDistricts();
  const { users, user } = useUsers(); // Get current user
  const { tasks } = useConsolidation();

  // Extraer filtro inicial si viene de la pantalla de distritos
  const initialFilter = location.state?.initialFilter || 'Todos';

  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState(initialFilter);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Efecto para actualizar el filtro si cambia el estado de navegación
  useEffect(() => {
    if (location.state?.initialFilter) {
      setDistrictFilter(location.state.initialFilter);
    }
  }, [location.state]);

  // Obtener distritos disponibles según rol
  const availableDistricts = districts.filter(d => {
    if (user?.role === UserRole.DISTRICT_SUPERVISOR) {
      return d.id === user.districtId;
    }
    return true;
  });

  // Unique Districts names for dropdown
  const uniqueDistricts = ['Todos', ...availableDistricts.map(d => d.name)];

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  const getDistrictName = (id: string) => {
    const district = districts.find(d => d.id === id);
    return district ? district.name : 'Sin distrito'; // Fallback if not found
  };

  const getCellMemberCount = (cellId: string) => {
    // Users context already includes all profiles (members + candidates)
    return users.filter(u => u.cellId === cellId).length;
  };

  const filteredCells = cells.filter(cell => {
    // RBAC: Leaders only see their own cell
    if (user?.role === UserRole.LEADER) {
      return cell.id === user.cellId;
    }

    // RBAC: District Supervisors only see cells in their district
    if (user?.role === UserRole.DISTRICT_SUPERVISOR) {
      if (cell.districtId !== user.districtId) return false;
    }

    const districtName = getDistrictName(cell.districtId);
    const matchesSearch = cell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      districtName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDistrict = districtFilter === 'Todos' || districtName === districtFilter;

    return matchesSearch && matchesDistrict;
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmingId === id) {
      deleteCell(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  };

  const getLeaderName = (leaderId: string) => {
    const user = users.find(u => u.id === leaderId);
    return user ? `${user.firstName} ${user.lastName}` : 'Líder no encontrado';
  };

  return (
    <Layout title="Gestión de Células">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Células</h1>
            <p className="text-text-secondary text-sm">Unidades básicas de crecimiento y discipulado.</p>
          </div>
          {user?.role !== 'Líder de Célula' && (
            <button
              onClick={() => navigate('/cells/create')}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-600 transition-all"
            >
              <span className="material-symbols-outlined">add_circle</span> Nueva Célula
            </button>
          )}
        </div>

        {/* Search and Filters Section */}
        {user?.role !== 'Líder de Célula' && (
          <div className="bg-surface-dark p-4 rounded-xl flex flex-wrap gap-4 border border-border-dark shadow-sm">
            <div className="relative flex-1 min-w-[280px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111822] text-white border-border-dark rounded-lg pl-10 pr-4 py-2 focus:ring-primary focus:border-primary transition-all"
                placeholder="Buscar por nombre de célula o distrito..."
              />
            </div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-[#111822] text-white border-border-dark rounded-lg px-4 py-2 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[180px]"
            >
              {uniqueDistricts.map(d => (
                <option key={d} value={d}>{d === 'Todos' ? 'Todos los distritos' : `${d}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCells.map((cell) => {
            const activeCount = getCellMemberCount(cell.id);
            return (
              <div
                key={cell.id}
                className="bg-surface-dark rounded-2xl overflow-hidden border border-border-dark group shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="h-40 bg-cover bg-center relative" style={{ backgroundImage: `url(${cell.imageUrl})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent opacity-80"></div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={() => navigate(`/cells/edit/${cell.id}`)}
                      className="bg-black/50 p-2 rounded-full text-white hover:bg-primary transition-all backdrop-blur-sm shadow-lg"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, cell.id)}
                      className={`p-2 rounded-full text-white transition-all backdrop-blur-sm shadow-lg flex items-center gap-1 ${confirmingId === cell.id ? 'bg-red-600 px-3' : 'bg-black/50 hover:bg-red-500'}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {confirmingId === cell.id ? 'warning' : 'delete'}
                      </span>
                      {confirmingId === cell.id && <span className="text-[10px] font-bold uppercase">Confirmar</span>}
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-4">
                    <span className="text-[10px] font-bold bg-primary/80 backdrop-blur-sm text-white px-2 py-0.5 rounded uppercase tracking-widest">
                      {getDistrictName(cell.districtId)}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-white font-bold text-xl mb-1">{cell.name}</h3>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <span className="material-symbols-outlined text-[18px]">account_circle</span>
                      <p>Líder: <span className="text-white font-medium">{getLeaderName(cell.leaderId)}</span></p>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary text-sm">
                      <span className="material-symbols-outlined text-[18px]">person_check</span>
                      <p>Asistentes Activos: <span className="text-white font-medium">{activeCount}</span></p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-border-dark/50 pt-4 mt-2">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-surface-dark bg-slate-700 flex items-center justify-center text-[10px] text-white">
                          <img src={`https://picsum.photos/seed/m${i + cell.id}/40/40`} className="rounded-full w-full h-full" alt="avatar" />
                        </div>
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-surface-dark bg-[#111822] flex items-center justify-center text-[10px] text-text-secondary">+{activeCount > 3 ? activeCount - 3 : 0}</div>
                    </div>
                    <button
                      onClick={() => navigate(`/cells/attendance/${cell.id}`)}
                      className="text-primary text-sm font-bold hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      Asistencia <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State Section */}
        {filteredCells.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4 bg-surface-dark rounded-3xl border border-dashed border-border-dark">
            <span className="material-symbols-outlined text-6xl text-text-secondary opacity-20">groups_3</span>
            <p className="text-text-secondary font-medium">No se encontraron células con los filtros actuales.</p>
            {(searchTerm || districtFilter !== 'Todos') && (
              <button
                onClick={() => { setSearchTerm(''); setDistrictFilter('Todos'); }}
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

export default CellListScreen;
