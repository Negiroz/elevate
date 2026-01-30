
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { UserRole } from '../types';
import { useUsers } from '../UserContext';
import { useDistricts } from '../DistrictContext';

interface UserFormScreenProps {
  mode: 'create' | 'edit';
}

const UserFormScreen: React.FC<UserFormScreenProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { users, addUser, updateUser } = useUsers();
  const { districts } = useDistricts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.MEMBER,
    active: true,
    imageUrl: '',
    password: '',
    districtId: '',
    cellId: ''
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      const user = users.find(u => u.id === id);
      if (user) {
        setFormData({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          active: user.active,
          imageUrl: user.imageUrl || `https://picsum.photos/seed/${id}/200/200`,
          password: '',
          districtId: user.districtId || '',
          cellId: user.cellId || ''
        });
      }
    }
  }, [mode, id, users]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      await addUser(formData, formData.password);
    } else if (id) {
      await updateUser(id, formData, formData.password);
    }
    navigate('/users');
  };

  /* filteredCells logic removed */

  return (
    <Layout title={mode === 'create' ? 'Crear Usuario' : 'Editar Usuario'}>
      <div className="max-w-4xl mx-auto w-full">
        {/* ... header ... */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/users')} className="p-2 text-text-secondary hover:text-white rounded-lg bg-surface-dark border border-border-dark">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-black text-white">{mode === 'create' ? 'Crear Nuevo Usuario' : 'Modificar Usuario'}</h1>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />

        {/* Profile Card Preview */}
        {(mode === 'edit' || formData.imageUrl) && (
          <div className="bg-surface-dark rounded-xl border border-border-dark p-6 mb-8 flex items-center gap-6">
            <div
              className="relative group cursor-pointer"
              onClick={handleImageClick}
              title="Cambiar foto de perfil"
            >
              <img
                src={formData.imageUrl || `https://picsum.photos/seed/new/200/200`}
                className="size-24 rounded-full border-4 border-background-dark object-cover group-hover:opacity-50 transition-all"
                alt="Profile"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full border-2 border-surface-dark shadow-lg">
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </div>
            </div>
            <div>
              <h2 className="text-white text-xl font-bold">
                {formData.firstName || formData.lastName ? `${formData.firstName} ${formData.lastName}` : 'Nuevo Usuario'}
              </h2>
              <p className="text-text-secondary">{formData.email || 'correo@ejemplo.com'}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded uppercase tracking-tighter">
                  {mode === 'edit' ? 'Editando Perfil' : 'Vista Previa'}
                </span>
                {formData.role === UserRole.LEADER && (
                  <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded uppercase tracking-tighter">
                    Líder
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface-dark rounded-xl border border-border-dark p-8 space-y-8 shadow-2xl">
          {mode === 'create' && !formData.imageUrl && (
            <div className="flex justify-center pb-4">
              <button
                type="button"
                onClick={handleImageClick}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-border-dark rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all text-text-secondary"
              >
                <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                <span className="text-sm font-bold">Subir foto de perfil</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold ml-1">Nombre</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Nombre"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold ml-1">Apellido</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Apellido"
                required
              />
            </div>


            <div className="space-y-2 md:col-span-2">
              <label className="text-white text-sm font-semibold ml-1">
                Contraseña {mode === 'edit' && <span className="text-text-secondary font-normal">(Dejar en blanco para mantener la actual)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 pr-12 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder={mode === 'create' ? "••••••••" : "Nueva contraseña (opcional)"}
                  required={mode === 'create'}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white p-1 rounded-lg transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <p className="text-xs text-text-secondary ml-1">Mínimo 6 caracteres.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-white text-sm font-semibold ml-1">Correo electrónico</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="ejemplo@iglesia.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold ml-1">Rol en la Iglesia</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                {Object.values(UserRole).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* District Selection - Important for Visibility */}
            <div className="space-y-2">
              <label className="text-white text-sm font-semibold ml-1">Distrito Asignado</label>
              <select
                value={formData.districtId}
                onChange={(e) => setFormData({ ...formData, districtId: e.target.value, cellId: '' })}
                className={`w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${!formData.districtId && formData.role === UserRole.LEADER ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                required={formData.role === UserRole.LEADER}
              >
                <option value="">-- Sin Distrito --</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {formData.role === UserRole.LEADER && !formData.districtId && (
                <p className="text-xs text-red-500 ml-1">Requerido para Líderes de Célula</p>
              )}
            </div>

            {/* Cell Selection Removed as per user request */}

            <div className="space-y-2 flex flex-col justify-end pb-3">
              <div className="flex items-center gap-3 bg-[#111822] border border-border-dark p-3.5 rounded-xl">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 rounded text-primary focus:ring-primary bg-surface-dark border-border-dark"
                />
                <span className="text-white text-sm font-medium">Usuario Activo</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-border-dark">
            <button
              onClick={() => navigate('/users')}
              type="button"
              className="px-6 py-3 text-text-secondary hover:text-white font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-primary hover:bg-blue-600 px-10 py-3 rounded-xl text-white font-bold shadow-lg shadow-primary/20 transition-all"
            >
              {mode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div >
    </Layout >
  );
};

export default UserFormScreen;
