
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useUsers } from '../UserContext';
import { useNotification } from '../NotificationContext';
import { UserRole } from '../types';
import AuditModal from '../components/AuditModal';
import { api } from '../lib/api';

const ProfileScreen: React.FC = () => {
  const { user, updateUser, loading } = useUsers();
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    password: '', // For password change
    confirmPassword: ''
  });

  // Audit State
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditIssues, setAuditIssues] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  // System Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await api.get('/settings');
      if (res && res.maintenance_mode) {
        setMaintenanceMode(res.maintenance_mode === 'true');
      }
    } catch (error) {
      console.error("Error fetching settings", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const toggleMaintenanceMode = async () => {
    const newValue = !maintenanceMode;
    // Optimistic update
    setMaintenanceMode(newValue);

    try {
      await api.post('/settings', { key: 'maintenance_mode', value: newValue });
      showNotification(`Modo Mantenimiento ${newValue ? 'ACTIVADO' : 'DESACTIVADO'}`, newValue ? 'warning' : 'success');
    } catch (error) {
      console.error("Error saving setting", error);
      setMaintenanceMode(!newValue); // Revert
      showNotification('Error al cambiar configuración', 'error');
    }
  };

  const handleAudit = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditError(''); // Clear previous errors
    try {
      const res = await api.get('/audit');
      // Handle response structure variation (direct data or wrapped in data property)
      const actualData = res.data || res;

      if (!actualData) {
        throw new Error('Datos vacíos recibidos del servidor');
      }
      setAuditIssues(actualData);
    } catch (error: any) {
      console.error('Audit error:', error);
      const msg = error.response?.data?.error || error.message || 'Error desconocido';
      setAuditError(msg);
      setAuditIssues(null);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || ''
      }));
      // Fetch settings if admin/pastor
      const isAdminOrPastor = user.role === UserRole.ADMIN || user.role === UserRole.PASTOR || user.role === UserRole.ASSOCIATE_PASTOR || user.role === UserRole.DISTRICT_SUPERVISOR;
      if (isAdminOrPastor) {
        fetchSettings();
      }
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate Password
    if (formData.password && formData.password !== formData.confirmPassword) {
      showNotification('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      await updateUser(user.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address
      }, formData.password); // Include password improvement in context later if needed

      showNotification('Perfil actualizado correctamente', 'success');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' })); // Reset sensitive fields
    } catch (error) {
      console.error(error);
      showNotification('Error al actualizar perfil', 'error');
    }
  };

  if (loading) return <div className="p-10 text-center text-white">Cargando perfil...</div>;
  if (!user) return <div className="p-10 text-center text-white">No hay sesión activa.</div>;

  const isAdminOrPastor = user.role === UserRole.ADMIN || user.role === UserRole.PASTOR || user.role === UserRole.ASSOCIATE_PASTOR || user.role === UserRole.DISTRICT_SUPERVISOR;

  return (
    <Layout title="Mi Perfil">
      <div className="max-w-4xl mx-auto w-full pb-20">
        <h1 className="text-3xl font-black text-white mb-8">Configuración de Perfil</h1>

        {/* Profile Identity Card */}
        <div className="bg-surface-dark rounded-3xl p-8 border border-border-dark shadow-2xl mb-10 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10">
            <div className="size-32 rounded-full border-4 border-background-dark shadow-2xl overflow-hidden bg-[#111822]">
              <img
                src={user.imageUrl || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=0D8ABC&color=fff`}
                className="w-full h-full object-cover"
                alt="Profile"
              />
            </div>
            {/* 
            <button className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full border-4 border-surface-dark shadow-lg">
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            </button> 
            */}
          </div>
          <div className="text-center md:text-left relative z-10">
            <h2 className="text-3xl font-black text-white mb-1">{user.firstName} {user.lastName}</h2>
            <p className="text-primary font-bold text-sm uppercase tracking-widest mb-4">
              {user.role} {user.districtId ? `• Distrito ${user.districtId}` : ''}
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="bg-[#111822] px-4 py-2 rounded-xl border border-border-dark">
                <p className="text-[10px] text-text-secondary uppercase font-black mb-0.5">Estado</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${user.active ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <p className="text-white font-bold">{user.active ? 'Activo' : 'Inactivo'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="space-y-8 bg-surface-dark border border-border-dark p-8 rounded-3xl shadow-xl">
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span> Datos Personales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-text-secondary text-xs font-black uppercase tracking-widest ml-1">Nombre</label>
              <input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-text-secondary text-xs font-black uppercase tracking-widest ml-1">Apellido</label>
              <input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-text-secondary text-xs font-black uppercase tracking-widest ml-1">Correo Electrónico (Solo lectura)</label>
              <input
                value={formData.email}
                readOnly
                className="w-full bg-[#111822] border-border-dark rounded-xl text-text-secondary px-4 py-3 cursor-not-allowed opacity-70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-text-secondary text-xs font-black uppercase tracking-widest ml-1">Teléfono</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary focus:border-transparent"
                placeholder="+54 ..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-text-secondary text-xs font-black uppercase tracking-widest ml-1">Dirección</label>
              <input
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full bg-[#111822] border-border-dark rounded-xl text-white px-4 py-3 focus:ring-primary focus:border-transparent"
                placeholder="Calle, Altura, Ciudad"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-border-dark/50 flex justify-end gap-4">
            <button
              type="button"
              onClick={handleSave}
              className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Security / Danger Zone */}
        <div className="mt-12 pt-12 border-t border-border-dark">
          <h3 className="text-xl font-black text-white mb-6">Seguridad</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl">
              <h4 className="text-white font-bold mb-4">Cambiar Contraseña</h4>
              <div className="space-y-4">
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Nueva Contraseña"
                  className="w-full bg-[#111822] border-border-dark rounded-lg text-white px-3 py-2 text-sm focus:ring-primary"
                />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirmar Contraseña"
                  className="w-full bg-[#111822] border-border-dark rounded-lg text-white px-3 py-2 text-sm focus:ring-primary"
                />
                <button
                  onClick={handleSave} // Reusing save for simplicity in this demo, ideally separate endpoint
                  disabled={!formData.password}
                  className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-bold w-full transition-colors disabled:opacity-50"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </div>

            <div className="bg-surface-dark border border-border-dark p-6 rounded-2xl flex flex-col justify-between items-start opacity-50 grayscale pointer-events-none">
              <div>
                <h4 className="text-red-400 font-bold">Zona de Peligro</h4>
                <p className="text-red-400/50 text-xs mt-1">Contacte al administrador para eliminar su cuenta.</p>
              </div>
              <span className="material-symbols-outlined text-red-900 mt-4 text-3xl">delete_forever</span>
            </div>
          </div>
        </div>


        {/* System Automations - Visible to all but only manageable by Admins in future */}
        {isAdminOrPastor && (
          <div className="mt-12 pt-12 border-t border-border-dark">
            <h3 className="text-xl font-black text-white mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">admin_panel_settings</span> Automatizaciones del Sistema
              </div>
              <button
                onClick={handleAudit}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-xs rounded-lg transition-all shadow-lg hover:shadow-indigo-500/25 font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">fact_check</span>
                Auditar Todo
              </button>
            </h3>
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden mb-8">
              {/* Maintenance Mode Item */}
              <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center border-b border-border-dark/50 last:border-0 hover:bg-yellow-500/5 transition-colors">
                <div className="bg-yellow-500/10 p-4 rounded-xl">
                  <span className="material-symbols-outlined text-yellow-500 text-3xl">engineering</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-white font-bold text-lg">Modo Mantenimiento</h4>
                    {maintenanceMode && (
                      <span className="bg-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed mb-2">
                    Si se activa, SOLO Pastores y Administradores podrán ingresar al sistema. Útil para realizar actualizaciones críticas.
                  </p>
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={maintenanceMode}
                      onChange={toggleMaintenanceMode}
                      disabled={settingsLoading}
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">

              {/* Birthday Automation Item */}
              <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center border-b border-border-dark/50 last:border-0 hover:bg-purple-500/5 transition-colors">
                <div className="bg-purple-500/10 p-4 rounded-xl">
                  <span className="material-symbols-outlined text-purple-400 text-3xl">cake</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-white font-bold text-lg">Recordatorios de Cumpleaños</h4>
                    <span className="bg-green-500/20 text-green-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Activo
                    </span>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed mb-2">
                    El sistema genera tareas de "Llamada de Cumpleaños" automáticamente todos los días a las 00:00.
                  </p>
                </div>
              </div>

              {/* Consolidation Automation Item (Example/Future) */}
              <div className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center last:border-0 opacity-50 grayscale">
                <div className="bg-blue-500/10 p-4 rounded-xl">
                  <span className="material-symbols-outlined text-blue-400 text-3xl">school</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-white font-bold text-lg">Seguimiento de Consolidación</h4>
                    <span className="bg-gray-700 text-gray-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      Próximamente
                    </span>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    Generación automática de tareas de visita basada en la etapa del nuevo creyente.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div >

      <AuditModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        issues={auditIssues}
        loading={auditLoading}
        errorMessage={auditError}
      />
    </Layout >
  );
};

export default ProfileScreen;
