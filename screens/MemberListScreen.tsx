
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, Link } from 'react-router-dom';
import { useUsers } from '../UserContext';
import { useDistricts } from '../DistrictContext';
import { useCells } from '../CellContext';
import { UserRole } from '../types';
import MemberDetailsModal from '../components/MemberDetailsModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useConsolidation } from '../ConsolidationContext';
import { useNotification } from '../NotificationContext';
import { api } from '../lib/api';

const MemberListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users, user, deleteUser, loading } = useUsers(); // Get 'user'
  console.log("MemberListScreen Render:", { usersCount: users.length, loading, hasUser: !!user });
  const { districts } = useDistricts();
  const { cells } = useCells();
  const { tasks, refreshTasks } = useConsolidation();
  const { showNotification } = useNotification();

  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('Todos');
  const [cellFilter, setCellFilter] = useState('Todas');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // RBAC
  const isCellLeader = user?.role === UserRole.LEADER || user?.role === 'Lider de celula';
  const isDistrictSupervisor = user?.role === UserRole.DISTRICT_SUPERVISOR;

  // Modal state
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; memberId: string | null; memberName: string }>({
    isOpen: false,
    memberId: null,
    memberName: ''
  });

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'role', direction: 'ascending' });

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Filter districts for dropdown
  const availableDistricts = districts.filter(d => {
    if (isDistrictSupervisor) {
      return d.id === user?.districtId;
    }
    return true;
  });

  // Filtrar células basadas en el distrito seleccionado (si hay alguno)
  const availableCells = cells.filter(c => {
    // If supervisor, restrict cells to their district even if filter is "Todos" (which implies their district)
    if (isDistrictSupervisor) {
      if (c.districtId !== user?.districtId) return false;
    }

    if (districtFilter === 'Todos') return true;
    return c.districtId === districtFilter;
  });

  const getDistrictName = (id?: string) => {
    if (!id) return 'Sin Distrito';
    return districts.find(d => d.id === id)?.name || id;
  };

  const getCellName = (id?: string) => {
    if (!id) return 'Sin Célula';
    return cells.find(c => c.id === id)?.name || 'N/A';
  };

  const handleDeleteClick = (e: React.MouseEvent, member: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!member.id) {
      showNotification("Error: ID inválido", 'error');
      return;
    }
    setDeleteModal({ isOpen: true, memberId: member.id, memberName: `${member.firstName} ${member.lastName}` });
  };

  const confirmDelete = async () => {
    if (deleteModal.memberId) {
      await deleteUser(deleteModal.memberId);
      refreshTasks().catch(console.error);
      showNotification('Miembro eliminado correctamente', 'success');
      setDeleteModal({ isOpen: false, memberId: null, memberName: '' });
    }
  };

  const handleRowClick = (user: any) => {
    setSelectedMember(user);
  };

  // REFACTOR: Users now includes everyone (members + candidates) because they overlap in 'profiles' table.
  // We no longer need to merge 'tasks' from ConsolidationContext.

  const allMembers = users;

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [limit, setLimit] = useState(50);
  const [paginatedUsers, setPaginatedUsers] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  useEffect(() => {
    fetchPaginatedUsers();
  }, [currentPage, limit, searchTerm, districtFilter, cellFilter]);

  const fetchPaginatedUsers = async () => {
    setIsLoadingList(true);
    try {
      let query = `/profiles?page=${currentPage}&limit=${limit}`;
      if (searchTerm) query += `&q=${encodeURIComponent(searchTerm)}`;
      if (districtFilter !== 'Todos') query += `&district=${districtFilter}`;
      if (cellFilter !== 'Todas') query += `&cell=${cellFilter}`;

      // Scope filters (District/Cell) should ideally be passed as Params if supported API
      // For now, if API only supports generic scope, we might still receive full list if we are admin
      // But for scalability we assume API honors q/page/limit first.

      const res = await api.get(query);

      // Helper for mapping (same as in UserContext to ensure consistency)
      const mapProfileToUser = (data: any) => ({
        id: data.id,
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        email: data.email || '',
        role: data.role || 'Miembro',
        active: data.active === 1 || data.active === true,
        imageUrl: data.image_url,
        joinDate: data.join_date,
        districtId: data.district_id,
        cellId: data.cell_id,
        birthDate: data.birth_date,
        maritalStatus: data.marital_status,
        gender: data.gender,
        profession: data.profession,
        address: data.address,
        phone: data.phone,
        consolidationStageId: data.consolidation_stage_id,
        conversionOrigin: data.conversion_origin,
        conversionEventId: data.conversion_event_id
      });

      if (res.pagination) {
        setPaginatedUsers(res.data.map(mapProfileToUser));
        setTotalPages(res.pagination.totalPages);
        setTotalUsers(res.pagination.total);
      } else {
        // Fallback if API returns full list
        const list = Array.isArray(res) ? res : (res.data || []);
        setPaginatedUsers(list.map(mapProfileToUser));
        setTotalPages(1);
        setTotalUsers(list.length);
      }
    } catch (e) {
      console.error("Error fetching paginated users", e);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  // We use the paginated list from backend instead of filtering all users locally
  const filteredUsers = paginatedUsers.filter(u => {
    // RBAC: Force Cell Filter for Leaders
    if (isCellLeader && user?.cellId) {
      if (u.cellId !== user.cellId) return false;
    }

    // RBAC: District Supervisor only sees their district
    if (isDistrictSupervisor && user?.districtId) {
      if (u.districtId !== user.districtId) return false;
    }

    // Server-side filtering handles District/Cell now.
    return true;
  }).sort((a, b) => {
    // Role hierarchy mapping
    const rolePriority: Record<string, number> = {
      [UserRole.PASTOR]: 1,
      [UserRole.ASSOCIATE_PASTOR]: 2,
      [UserRole.DISTRICT_SUPERVISOR]: 3,
      [UserRole.LEADER]: 4,
      [UserRole.TIMOTEO]: 5,
      [UserRole.MEMBER]: 6,
      [UserRole.VISITOR]: 7,
      [UserRole.ADMIN]: 0
    };

    if (sortConfig.key === 'role') {
      const priorityA = rolePriority[a.role] ?? 99;
      const priorityB = rolePriority[b.role] ?? 99;
      return sortConfig.direction === 'ascending' ? priorityA - priorityB : priorityB - priorityA;
    }

    // Default sorting for other columns
    let valA: any = '';
    let valB: any = '';

    switch (sortConfig.key) {
      case 'name':
        valA = `${a.firstName} ${a.lastName}`.toLowerCase();
        valB = `${b.firstName} ${b.lastName}`.toLowerCase();
        break;
      case 'district':
        valA = getDistrictName(a.districtId).toLowerCase();
        valB = getDistrictName(b.districtId).toLowerCase();
        break;
      case 'cell':
        valA = getCellName(a.cellId).toLowerCase();
        valB = getCellName(b.cellId).toLowerCase();
        break;
      case 'active':
        valA = a.active ? 1 : 0;
        valB = b.active ? 1 : 0;
        break;
      default:
        valA = (a as any)[sortConfig.key];
        valB = (b as any)[sortConfig.key];
    }

    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
    return 0;
  });

  return (
    <Layout title="Gestión de Miembros">
      {selectedMember && (
        <MemberDetailsModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={confirmDelete}
        title="Eliminar Miembro"
        message={`¿Estás seguro de que deseas eliminar a ${deleteModal.memberName}? Esta acción no se puede deshacer.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
      />
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Fichero de la Iglesia</h1>
            <p className="text-text-secondary text-sm">Registro general de miembros. <span className="text-primary font-bold">Total: {totalUsers}</span></p>
          </div>
          <button
            onClick={() => navigate('/members/create')}
            className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
          >
            <span className="material-symbols-outlined">person_add</span> Agregar Miembro
          </button>
        </div>

        {/* Filters */}
        <div className="bg-surface-dark p-4 rounded-xl flex flex-wrap gap-4 border border-border-dark shadow-sm">
          <div className="relative flex-1 min-w-[280px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">search</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111822] text-white border-border-dark rounded-lg pl-10 pr-4 py-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="Buscar por nombre, correo o rol..."
            />
          </div>

          {!isCellLeader && (
            <>
              <select
                value={districtFilter}
                onChange={(e) => { setDistrictFilter(e.target.value); setCellFilter('Todas'); }}
                className="bg-[#111822] text-white border-border-dark rounded-lg px-4 py-2 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[180px]"
              >
                <option value="Todos">Todos los Distritos</option>
                {availableDistricts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={cellFilter}
                onChange={(e) => setCellFilter(e.target.value)}
                className="bg-[#111822] text-white border-border-dark rounded-lg px-4 py-2 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[180px]"
              >
                <option value="Todas">Todas las Células</option>
                {availableCells.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Table */}
        <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#111822] text-text-secondary text-[10px] uppercase tracking-widest font-black">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      Miembro {sortConfig.key === 'name' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('role')}>
                    <div className="flex items-center gap-1">
                      Categoría {sortConfig.key === 'role' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('district')}>
                    <div className="flex items-center gap-1">
                      Distrito {sortConfig.key === 'district' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('cell')}>
                    <div className="flex items-center gap-1">
                      Célula {sortConfig.key === 'cell' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('active')}>
                    <div className="flex items-center gap-1">
                      Estado {sortConfig.key === 'active' && <span className="material-symbols-outlined text-[14px]">{sortConfig.direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => handleRowClick(u)}
                    className="hover:bg-[#233348]/30 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {(!u.id) && console.error("RENDER ERROR: Missing ID for user", u)}
                        <img src={u.imageUrl || `https://picsum.photos/seed/${u.id}/100/100`} className="w-10 h-10 rounded-full object-cover border-2 border-border-dark" alt={u.firstName} />
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            {u.firstName} {u.lastName}
                            {(() => {
                              const missingFields = [
                                !u.phone,
                                !u.address,
                                !u.birthDate,
                                !u.email,
                                !u.profession,
                                !u.maritalStatus
                              ].filter(Boolean).length;

                              if (missingFields > 0) {
                                return (
                                  <div className="group/tooltip relative flex items-center">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold border border-orange-500/30">
                                      {missingFields}
                                    </span>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
                                      Datos faltantes
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            {(() => {
                              if (!u.birthDate) return null;

                              const today = new Date();
                              const parts = u.birthDate.split('-');

                              // DEBUG: Log for everyone temporarily to see format
                              const [year, month, day] = parts;
                              if (String(today.getMonth() + 1).padStart(2, '0') === month &&
                                String(today.getDate()).padStart(2, '0') === day) {
                                return (
                                  <span
                                    className="material-symbols-outlined text-pink-500 text-[18px] animate-bounce"
                                    title="¡Feliz Cumpleaños!"
                                  >
                                    cake
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <p className="text-[10px] text-text-secondary">Desde {new Date(u.joinDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${u.role === UserRole.PASTOR ? 'bg-purple-500/10 text-purple-400' :
                        u.role === UserRole.LEADER ? 'bg-blue-500/10 text-blue-400' :
                          u.role === UserRole.TIMOTEO ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                            'bg-slate-500/10 text-slate-400'
                        }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-xs font-bold">{getDistrictName(u.districtId)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-primary text-xs font-bold">{getCellName(u.cellId)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={`text-[10px] font-black uppercase ${u.active ? 'text-green-500' : 'text-red-500'}`}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2 items-center">
                        <Link
                          to={`/members/edit/${u.id}`}
                          className={`p-2 text-text-secondary hover:text-white bg-transparent hover:bg-white/5 rounded-lg transition-all ${confirmingId === u.id ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </Link>
                        {!isCellLeader && (
                          <button
                            onClick={(e) => handleDeleteClick(e, u)}
                            className="flex items-center gap-1 p-2 rounded-lg transition-all duration-200 text-text-secondary hover:text-red-400 hover:bg-red-500/5"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-6xl text-text-secondary opacity-20">person_off</span>
              <p className="text-text-secondary font-bold">No se encontraron resultados en el fichero.</p>
              <button onClick={() => { setSearchTerm(''); setDistrictFilter('Todos'); setCellFilter('Todas'); }} className="text-primary text-sm font-bold hover:underline">Restablecer búsqueda</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MemberListScreen;
