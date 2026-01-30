
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, Link } from 'react-router-dom';
import { useUsers } from '../UserContext';
import { useDistricts } from '../DistrictContext';
import { UserRole } from '../types';

const UserListScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users, deleteUser } = useUsers();
  const { districts } = useDistricts();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Limpiar el estado de confirmación si el usuario deja de interactuar
  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  // Filter out non-system users (Members and Visitors)
  const systemUsers = users.filter(u => u.role !== UserRole.MEMBER && u.role !== UserRole.VISITOR);

  const filteredUsers = systemUsers.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'Todos' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirmingId === id) {
      // Segunda pulsación: ejecutar eliminación
      deleteUser(id);
      setConfirmingId(null);
    } else {
      // Primera pulsación: pedir confirmación
      setConfirmingId(id);
    }
  };

  return (
    <Layout title="Gestión de Usuarios">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Lista de Usuarios del Sistema</h1>
          <button
            onClick={() => navigate('/users/create')}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span> Crear Nuevo Usuario
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
              placeholder="Buscar por nombre o rol..."
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#111822] text-white border-border-dark rounded-lg px-4 py-2 focus:ring-primary focus:border-primary transition-all cursor-pointer min-w-[180px]"
          >
            <option value="Todos">Todos los roles</option>
            {Object.values(UserRole)
              .filter(role => role !== UserRole.MEMBER && role !== UserRole.VISITOR)
              .map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#111822] text-text-secondary text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Distrito</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#233348]/30 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="relative">
                        <img src={u.imageUrl || `https://picsum.photos/seed/${u.id}/100/100`} className="w-10 h-10 rounded-full object-cover border-2 border-border-dark" alt={u.firstName} />
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface-dark ${u.active ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      </div>
                      <span className="text-white font-medium">{u.firstName} {u.lastName}</span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary text-sm">{u.role}</td>
                    <td className="px-6 py-4 text-text-secondary text-sm">
                      {districts.find(d => d.id === u.districtId)?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        <Link
                          to={`/users/edit/${u.id}`}
                          className={`p-2 text-text-secondary hover:text-white hover:bg-white/5 rounded-lg transition-all ${confirmingId === u.id ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, u.id)}
                          className={`flex items-center gap-1 p-2 rounded-lg transition-all duration-200 ${confirmingId === u.id
                            ? 'bg-red-500 text-white px-3 py-1 animate-pulse'
                            : 'text-text-secondary hover:text-red-400 hover:bg-red-500/5'
                            }`}
                          title={confirmingId === u.id ? "Click para confirmar" : "Eliminar usuario"}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {confirmingId === u.id ? 'report' : 'delete'}
                          </span>
                          {confirmingId === u.id && <span className="text-[10px] font-bold uppercase">¿Borrar?</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-6xl text-text-secondary opacity-20">group_off</span>
              <p className="text-text-secondary">No se encontraron usuarios que coincidan con los filtros seleccionados.</p>
              {(searchTerm || roleFilter !== 'Todos') && (
                <button
                  onClick={() => { setSearchTerm(''); setRoleFilter('Todos'); }}
                  className="mt-4 text-primary text-sm font-bold hover:underline"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UserListScreen;
