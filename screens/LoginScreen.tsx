
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../UserContext';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useUsers();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: loginError } = await signIn(email, password);

    if (loginError) {
      // Check if it's the maintenance error object passed from UserContext/api
      const msg = loginError.message || loginError;
      setError(msg);
      setLoading(false);
    } else {
      // Navigation will be handled or verified; usually auth state change triggers but manual nav helps UX
      navigate('/welcome');
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-background-light dark:bg-background-dark">
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-dark items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center z-0 opacity-20 mix-blend-overlay scale-110 blur-sm" style={{ backgroundImage: 'url("https://picsum.photos/seed/church/1200/1200")' }}></div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/60 to-background-dark/95 z-10"></div>
        <div className="relative z-20 flex flex-col items-start justify-center px-16 max-w-xl">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-white/20">
              <span className="material-symbols-outlined text-primary text-4xl font-black">local_fire_department</span>
            </div>
            <div>
              <h1 className="text-white text-4xl font-black leading-none italic tracking-tighter">ELEVATE</h1>
              <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Church Management</p>
            </div>
          </div>
          <h2 className="text-5xl font-black text-white mb-6 leading-[1.1] tracking-tight">Gestión Eclesiástica para la EXPANSION.</h2>
          <p className="text-white/70 text-lg leading-relaxed font-medium">Potencia el discipulado y organiza tu iglesia celular con herramientas diseñadas para el crecimiento y la comunidad.</p>
          <div className="mt-10 flex gap-6">
            <div className="flex flex-col">
              <span className="text-white text-2xl font-black tracking-tight">2.5k+</span>
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Iglesias</span>
            </div>
            <div className="w-px h-10 bg-white/20 self-center"></div>
            <div className="flex flex-col">
              <span className="text-white text-2xl font-black tracking-tight">100k+</span>
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Miembros</span>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:px-24">
          <div className="lg:hidden flex flex-col items-center gap-3 mb-12 self-center">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
              <span className="material-symbols-outlined text-white text-3xl font-black">local_fire_department</span>
            </div>
            <h1 className="text-white text-2xl font-black italic tracking-tighter">ELEVATE</h1>
          </div>
          <div className="w-full max-w-md space-y-10">
            <div className="text-center lg:text-left space-y-3">
              <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Bienvenido</h1>
              <p className="text-gray-500 dark:text-text-secondary font-medium">Ingresa tus credenciales para acceder al panel de gestión.</p>
            </div>
            <form className="space-y-6" onSubmit={handleLogin}>
              {error && (
                <div className={`p-4 rounded-xl text-sm font-medium border ${error.toLowerCase().includes("mantenimiento") ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' : 'bg-red-500/10 border-red-500/50 text-red-500'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined">{error.toLowerCase().includes("mantenimiento") ? 'engineering' : 'error'}</span>
                    <span className="font-bold">{error.toLowerCase().includes("mantenimiento") ? 'Mantenimiento en Curso' : 'Error de Acceso'}</span>
                  </div>
                  {!error.toLowerCase().includes("mantenimiento") && error}
                  {error.includes("Email not confirmed") && (
                    <div className="mt-2 text-xs opacity-90 border-t border-red-500/20 pt-2">
                      <span className="font-bold">Ayuda:</span> El correo no ha sido verificado. Revisa tu bandeja de entrada o spam para confirmar tu cuenta.
                    </div>
                  )}
                  {error.includes("Invalid login credentials") && (
                    <div className="mt-2 text-xs opacity-90 border-t border-red-500/20 pt-2">
                      <span className="font-bold">Ayuda:</span> Correo o contraseña incorrectos. Verifica que el usuario haya sido creado y confirmado.
                    </div>
                  )}
                  {error.toLowerCase().includes("mantenimiento") && (
                    <div className="mt-2 text-sm opacity-90 border-t border-yellow-500/20 pt-3 text-yellow-600 dark:text-yellow-500">
                      <p className="font-normal leading-relaxed">{error.replace('Sistema en Mantenimiento', '').trim()}</p>
                      <p className="mt-2 text-xs font-bold opacity-75">Solo personal autorizado (Pastores/Admins) puede ingresar.</p>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-sm font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 ml-1" htmlFor="email">Email</label>
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-[20px] group-focus-within:text-primary transition-colors">mail</span>
                  </div>
                  <input
                    className="block w-full rounded-2xl border-0 py-4 pl-12 pr-4 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-border-dark placeholder:text-gray-400 dark:placeholder:text-gray-700 focus:ring-2 focus:ring-inset focus:ring-primary bg-white dark:bg-surface-dark sm:text-sm sm:leading-6 transition-all"
                    id="email"
                    placeholder="ejemplo@iglesia.com"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 ml-1" htmlFor="password">Contraseña</label>
                  <a href="#" className="text-xs font-bold text-primary hover:underline">¿La olvidaste?</a>
                </div>
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 text-[20px] group-focus-within:text-primary transition-colors">lock</span>
                  </div>
                  <input
                    className="block w-full rounded-2xl border-0 py-4 pl-12 pr-10 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-border-dark placeholder:text-gray-400 dark:placeholder:text-gray-700 focus:ring-2 focus:ring-inset focus:ring-primary bg-white dark:bg-surface-dark sm:text-sm sm:leading-6 transition-all"
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary bg-background-light dark:bg-surface-dark border-gray-300 dark:border-border-dark" />
                <span className="text-sm font-medium text-text-secondary">Recordar mi sesión</span>
              </div>
              <button
                className="flex w-full justify-center items-center gap-3 rounded-2xl bg-primary px-3 py-4 text-sm font-black leading-6 text-white shadow-xl shadow-primary/20 hover:bg-blue-600 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Iniciando...' : 'Iniciar Sesión'} <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>

            </form>
            <div className="text-center">
              <p className="text-sm text-text-secondary">¿Aún no tienes cuenta? <a href="#" className="text-primary font-bold hover:underline">Contacta a tu pastor</a></p>
            </div>
          </div>
        </div>
        <footer className="p-8 text-center text-xs text-text-secondary/50 font-bold uppercase tracking-widest">
          &copy; 2024 Elevate Church Systems • V2.4.0
        </footer>
      </div>
    </div>
  );
};

export default LoginScreen;
