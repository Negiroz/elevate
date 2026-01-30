
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTasks } from '../TaskContext';
import { useUsers } from '../UserContext';
import { useNotification } from '../NotificationContext';

interface SidebarItemProps {
  to: string;
  icon: string;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, collapsed }) => (
  <Link
    to={to}
    title={collapsed ? label : ''}
    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group relative ${active
      ? 'bg-primary/20 text-white shadow-sm ring-1 ring-primary/30'
      : 'text-[#92a9c9] hover:bg-[#233348] hover:text-white'
      } ${collapsed ? 'justify-center' : ''}`}
  >
    <span className={`material-symbols-outlined text-2xl ${active ? 'fill-1' : ''}`}>{icon}</span>
    {!collapsed && (
      <span className="text-sm font-medium leading-normal whitespace-nowrap overflow-hidden transition-all duration-300 origin-left">
        {label}
      </span>
    )}
    {collapsed && (
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
        {label}
      </div>
    )}
  </Link>
);

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { getPendingCount } = useTasks();
  const { user } = useUsers();
  const { showNotification } = useNotification();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize from localStorage or default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const isActive = (path: string) => location.pathname.startsWith(path);
  const pendingCount = getPendingCount(user?.id || '');

  const handleShare = async () => {
    const shareData = {
      title: 'ELEVATE Church Management',
      text: 'Accede al sistema de gestión de iglesia ELEVATE aquí:',
      url: window.location.origin
    };

    // 1. Try Native Web Share (Mobile/HTTPS)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        console.warn('Share API failed or cancelled:', err);
        // Continue to fallback
      }
    }

    // 2. Try Modern Clipboard API (HTTPS/Localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        showNotification('Enlace copiado al portapapeles', 'success');
        return;
      } catch (err) {
        console.warn('Clipboard API failed (likely non-secure context):', err);
        // Continue to fallback
      }
    }

    // 3. Fallback: Legacy TextArea Hack (Works on HTTP)
    try {
      const textArea = document.createElement("textarea");
      textArea.value = shareData.url;

      // Ensure it's not visible but part of DOM
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        showNotification('Enlace copiado al portapapeles', 'success');
      } else {
        throw new Error('Copy command failed');
      }
    } catch (err) {
      console.error('All share methods failed:', err);
      // 4. Ultimate Fallback: Manual Prompt
      prompt("No pudimos copiarlo automáticamente. Por favor copia este enlace:", shareData.url);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex flex-col h-full border-r border-border-dark bg-[#111822] shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
          }`}
      >
        <div className="flex flex-col h-full p-4 justify-between">
          <div className="flex flex-col gap-6">
            <div className={`flex items-center gap-3 px-2 py-4 ${isCollapsed ? 'justify-center' : ''}`}>
              <div
                onClick={toggleSidebar}
                className="flex items-center justify-center h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary to-blue-800 shadow-lg shadow-primary/20 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-white text-2xl">local_fire_department</span>
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden whitespace-nowrap">
                  <h1 className="text-white text-xl font-black leading-none tracking-tighter italic">ELEVATE</h1>
                  <p className="text-primary text-[9px] font-black uppercase tracking-[0.2em] mt-1">Church Management</p>
                </div>
              )}
            </div>

            <nav className="flex flex-col gap-1">
              <SidebarItem to="/dashboard" icon="dashboard" label="Dashboard" active={isActive('/dashboard')} collapsed={isCollapsed} />
              <SidebarItem to="/consolidation" icon="school" label="Consolidación" active={isActive('/consolidation')} collapsed={isCollapsed} />
              <SidebarItem to="/members" icon="person" label="Miembros" active={isActive('/members')} collapsed={isCollapsed} />
              <SidebarItem to="/cells" icon="groups" label="Células" active={isActive('/cells')} collapsed={isCollapsed} />

              {/* RBAC: Hide Districts and Users for Cell Leaders */}
              {/* RBAC: Hide Districts and Users for Cell Leaders */}
              {user?.role !== 'Líder de Célula' && user?.role !== 'Lider de celula' && (
                <>
                  <SidebarItem to="/districts" icon="map" label="Distritos" active={isActive('/districts')} collapsed={isCollapsed} />
                  <SidebarItem to="/users" icon="manage_accounts" label="Usuarios del sistema" active={isActive('/users')} collapsed={isCollapsed} />
                </>
              )}

              <SidebarItem to="/tasks" icon="check_circle" label="Mis Tareas" active={isActive('/tasks')} collapsed={isCollapsed} />
              <SidebarItem to="/events" icon="event" label="Eventos" active={isActive('/events')} collapsed={isCollapsed} />

              {user?.role !== 'Líder de Célula' && user?.role !== 'Lider de celula' && (
                <SidebarItem to="/announcements" icon="campaign" label="Anuncios" active={isActive('/announcements')} collapsed={isCollapsed} />
              )}

              <SidebarItem to="/reports" icon="query_stats" label="Reportes" active={isActive('/reports')} collapsed={isCollapsed} />
            </nav>
          </div>

          <div className="flex flex-col gap-2 border-t border-[#233348] pt-4">
            <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-end'} px-2 mb-2`}>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-[#92a9c9] hover:bg-[#233348] hover:text-white transition-colors"
                title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
              >
                <span className="material-symbols-outlined text-xl">
                  {isCollapsed ? 'chevron_right' : 'chevron_left'}
                </span>
              </button>
            </div>

            <SidebarItem to="/profile" icon="settings" label="Configuración" active={isActive('/profile')} collapsed={isCollapsed} />

            <button
              onClick={() => navigate('/')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[#92a9c9] hover:bg-[#233348] hover:text-white transition-colors group relative ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? "Cerrar Sesión" : ""}
            >
              <span className="material-symbols-outlined text-2xl">logout</span>
              {!isCollapsed && (
                <span className="text-sm font-medium leading-normal">Cerrar Sesión</span>
              )}
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                  Cerrar Sesión
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#233348] px-6 lg:px-10 bg-background-dark md:border-b-0 md:bg-transparent">
          <div className="flex items-center gap-4 text-white">
            <span
              className="material-symbols-outlined text-2xl cursor-pointer md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              menu
            </span>
            <h2 className="text-white text-lg font-bold leading-tight tracking-tight">{title}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleShare}
              className="hidden sm:flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg border border-primary/20 transition-all hover:scale-105 active:scale-95"
              title="Compartir enlace del sistema"
            >
              <span className="material-symbols-outlined text-sm">share</span>
              <span className="text-xs font-black uppercase tracking-wider">Compartir</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 bg-surface-dark px-3 py-1.5 rounded-lg border border-border-dark">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-text-secondary">Sistema en línea</span>
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="relative p-2 rounded-full hover:bg-surface-dark transition-colors group"
            >
              <span className="material-symbols-outlined text-text-secondary group-hover:text-white">notifications</span>
              {pendingCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-background-dark">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* User Profile Info */}
            {user && (
              <div className="flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-border-dark sm:ml-2">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-white leading-none">{user.firstName} {user.lastName}</p>
                  <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider mt-0.5">{user.role}</p>
                </div>
                <button onClick={() => navigate('/profile')} className="relative group">
                  <img
                    src={user.imageUrl || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}&background=0D8ABC&color=fff`}
                    alt={user.firstName}
                    className="w-9 h-9 rounded-full border border-border-dark object-cover group-hover:border-primary transition-colors"
                  />
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:p-8 scroll-smooth">
          {children}
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside className="w-64 h-full bg-[#111822] p-4 animate-in slide-in-from-left duration-200 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary">
                  <span className="material-symbols-outlined text-white text-xl">local_fire_department</span>
                </div>
                <span className="text-white font-black italic tracking-tighter">ELEVATE</span>
              </div>
              <nav className="flex flex-col gap-2">
                <SidebarItem to="/dashboard" icon="dashboard" label="Dashboard" active={isActive('/dashboard')} />
                <SidebarItem to="/consolidation" icon="school" label="Consolidación" active={isActive('/consolidation')} />
                <SidebarItem to="/members" icon="person" label="Miembros" active={isActive('/members')} />
                <SidebarItem to="/cells" icon="groups" label="Células" active={isActive('/cells')} />

                {user?.role !== 'Líder de Célula' && user?.role !== 'Lider de celula' && (
                  <>
                    <SidebarItem to="/districts" icon="map" label="Distritos" active={isActive('/districts')} />
                    <SidebarItem to="/users" icon="manage_accounts" label="Usuarios del sistema" active={isActive('/users')} />
                  </>
                )}

                <SidebarItem to="/tasks" icon="check_circle" label="Mis Tareas" active={isActive('/tasks')} />
                <SidebarItem to="/events" icon="event" label="Eventos" active={isActive('/events')} />

                {user?.role !== 'Líder de Célula' && user?.role !== 'Lider de celula' && (
                  <SidebarItem to="/announcements" icon="campaign" label="Anuncios" active={isActive('/announcements')} />
                )}

                <SidebarItem to="/reports" icon="query_stats" label="Reportes" active={isActive('/reports')} />

                <button
                  onClick={handleShare}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-primary hover:bg-primary/20 transition-colors w-full text-left bg-primary/10 mb-2 border border-primary/20"
                >
                  <span className="material-symbols-outlined text-2xl">share</span>
                  <span className="text-sm font-black uppercase tracking-wider">Compartir Sistema</span>
                </button>

                <div className="border-t border-[#233348] my-2 pt-2">
                  <SidebarItem to="/profile" icon="settings" label="Configuración" active={isActive('/profile')} />
                  <button
                    onClick={() => navigate('/')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#92a9c9] hover:bg-[#233348] hover:text-white transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-2xl">logout</span>
                    <span className="text-sm font-medium leading-normal">Cerrar Sesión</span>
                  </button>
                </div>
              </nav>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Layout;
