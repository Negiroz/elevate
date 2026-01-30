import React, { useMemo, useState, useEffect } from 'react';
import Layout from '../components/Layout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../UserContext';
import { useCells } from '../CellContext';
import { useConsolidation } from '../ConsolidationContext';
import { useTasks } from '../TaskContext';
import { api } from '../lib/api';
import { format, subWeeks, startOfWeek, endOfWeek, parseISO, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserRole } from '../types';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  icon: string;
  color: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, trend, icon, color, onClick }) => (
  <div
    onClick={onClick}
    className={`flex flex-col gap-2 rounded-xl p-5 bg-surface-dark border border-border-dark shadow-sm relative overflow-hidden group ${onClick ? 'cursor-pointer hover:border-primary/50 hover:bg-[#1A2332] transition-all' : ''}`}
  >
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
      <span className={`material-symbols-outlined text-4xl ${color}`}>{icon}</span>
    </div>
    <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-white text-3xl font-black">{value}</p>
      {trend && <span className="text-emerald-500 text-xs font-bold">{trend}</span>}
    </div>
  </div>
);

const AgeDistributionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  ageData: any[];
  averageAge: number;
}> = ({ isOpen, onClose, ageData, averageAge }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111822] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-border-dark flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border-dark flex justify-between items-center bg-surface-dark">
          <div>
            <h3 className="text-xl font-black text-white">Distribución de Edades</h3>
            <p className="text-text-secondary text-xs mt-1">Edad Promedio: <span className="text-emerald-400 font-bold">{averageAge} años</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <span className="material-symbols-outlined text-text-secondary">close</span>
          </button>
        </div>

        <div className="p-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Miembros" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-surface-dark p-4 rounded-xl border border-border-dark">
              <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Grupo Mayoritario</p>
              <p className="text-white text-lg font-bold">
                {ageData.reduce((max, current) => (current.count > max.count ? current : max), { range: '-', count: 0 }).range}
              </p>
            </div>
            <div className="bg-surface-dark p-4 rounded-xl border border-border-dark">
              <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mb-1">Total Analizados</p>
              <p className="text-white text-lg font-bold">
                {ageData.reduce((sum, item) => sum + item.count, 0)} Personas
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardScreen: React.FC = () => {
  const { users, user } = useUsers(); // Get 'user' (current logged in)
  const { cells } = useCells();
  const { tasks: consolidationTasks, stages } = useConsolidation();
  const { tasks: systemTasks } = useTasks();
  const navigate = useNavigate();

  const [selectedDistrict, setSelectedDistrict] = useState('Todos');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isMultiplierModalOpen, setIsMultiplierModalOpen] = useState(false);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);

  // RBAC: Filter Data for Cell Leaders
  const isCellLeader = user?.role === 'Líder de Célula';

  const filteredUsers = useMemo(() => {
    if (isCellLeader && user?.cellId) {
      return users.filter(u => u.cellId === user.cellId);
    }
    return users;
  }, [users, isCellLeader, user]);

  const filteredCells = useMemo(() => {
    if (isCellLeader && user?.cellId) {
      return cells.filter(c => c.id === user.cellId);
    }
    return cells;
  }, [cells, isCellLeader, user]);

  // Chart Data State
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<any>(null); // New state for backend stats
  const [districts, setDistricts] = useState<any[]>([]); // Districts for filter
  const [chartActiveBase, setChartActiveBase] = useState<number | null>(null); // Active count specifically for the chart context

  const [isTimoteoModalOpen, setIsTimoteoModalOpen] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchDistricts();
  }, []);

  const fetchDistricts = async () => {
    try {
      const data = await api.get('/districts');
      setDistricts(data);
    } catch (error) {
      console.error("Error fetching districts:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.get('/stats/dashboard');
      setDashboardStats(data);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setLoadingChart(false);
    }
  };

  // Legacy client-side calculation fallback (only minimal if needed, mostly replaced by dashboardStats)
  // We keep `stats` memo for backward compatibility with older components if they rely on it strictly, 
  // but we should map dashboardStats to the expected format.

  const stats = useMemo(() => {
    if (!dashboardStats) return {
      activeCount: 0, inactiveCount: 0, totalCells: 0, cellsToMultiplyCount: 0,
      timoteoCount: 0, timoteoList: [], timoteosByCell: [],
      churchAge: { average: 0, distribution: [] },
      taskControl: { pending: 0, overdue: 0 },
      genderStats: [], decadeStats: [], districtStats: []
    };

    return {
      activeCount: dashboardStats.activeCount,
      inactiveCount: dashboardStats.inactiveCount,
      totalCells: dashboardStats.totalCells,
      // Cells To Multiply Logic moved to backend
      cellsToMultiplyCount: dashboardStats.cellsToMultiplyCount,
      cellsToMultiplyList: dashboardStats.cellsToMultiplyList || [],

      timoteoCount: dashboardStats.timoteoCount,
      timoteoList: [], // Not needed for count card
      timoteosByCell: dashboardStats.timoteosByCell || [], // Would fetch on demand

      churchAge: dashboardStats.churchAge,

      taskControl: dashboardStats.taskControl,

      // Placeholder for charts not yet optimized in backend endpoint or needing complex data
      genderStats: dashboardStats.genderStats || [
        { name: 'Hombres', value: 0, color: '#3b82f6' },
        { name: 'Mujeres', value: 0, color: '#ec4899' }
      ],
      decadeStats: dashboardStats.churchAge?.distribution || [],
      districtStats: dashboardStats.districtStats || []
    };
  }, [dashboardStats]);

  // 2. Fetch Real Attendance Data for Chart
  useEffect(() => {
    const fetchAttendance = async () => {
      setLoadingChart(true);
      try {
        const endDate = new Date();
        const startDate = subWeeks(endDate, 6); // Last 6 weeks

        // Use new API with District Filter
        let url = `/attendance?from=${startDate.toISOString()}&status=present`;
        if (selectedDistrict !== 'Todos') {
          url += `&district_id=${selectedDistrict}`;
        }
        const data = await api.get(url);

        // Process data: Group by week
        const weeksMap: Record<string, { celulas: number, servicio: number, name: string }> = {};

        // Initialize last 6 weeks
        for (let i = 5; i >= 0; i--) {
          const d = subWeeks(endDate, i);
          const weekStart = startOfWeek(d, { weekStartsOn: 1 });
          const weekLabel = `Sem ${format(weekStart, 'w', { locale: es })}`; // Week number
          weeksMap[weekLabel] = { name: weekLabel, celulas: 0, servicio: 0 };
        }

        data?.forEach((record: any) => {
          const recordDate = parseISO(record.date);
          const weekStart = startOfWeek(recordDate, { weekStartsOn: 1 });
          const weekLabel = `Sem ${format(weekStart, 'w', { locale: es })}`;

          if (weeksMap[weekLabel]) {
            if (record.type === 'cell') weeksMap[weekLabel].celulas += 1;
            if (record.type === 'service') weeksMap[weekLabel].servicio += 1;
          }
        });

        const formattedData = Object.values(weeksMap);
        setChartData(formattedData);

      } catch (err) {
        console.error("Error fetching dashboard chart data:", err);
      } finally {
        setLoadingChart(false);
      }
    };

    const fetchActiveCount = async () => {
      try {
        let url = '/stats/active-count';
        if (selectedDistrict !== 'Todos') {
          url += `?district_id=${selectedDistrict}`;
        }
        const res = await api.get(url);
        setChartActiveBase(res.count);
      } catch (err) {
        console.error("Error fetching active count for chart", err);
      }
    };

    fetchAttendance();
    fetchActiveCount(); // Fetch base capacity for chart context
  }, [selectedDistrict]);

  // 3. Funnel Data (Real from Consolidation)
  const funnelData = useMemo(() => {
    return stages.map((stage, idx) => {
      const count = consolidationTasks.filter(t => t.stage === stage.id).length;
      // Simple coloring logic based on index
      const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500'];

      // Calculate % relative to total candidates for visualization
      const totalCandidates = consolidationTasks.length;
      const progress = totalCandidates > 0 ? (count / totalCandidates) * 100 : 0;

      // Or maybe accumulation? Funnels usually shrink. let's just show raw relative size or make up a "goal".
      // Let's use relative to MAX count for the bar visual
      const maxCount = Math.max(...stages.map(s => consolidationTasks.filter(t => t.stage === s.id).length), 1);
      const visualProgress = (count / maxCount) * 100;

      return {
        label: stage.title,
        value: count.toString(),
        progress: visualProgress,
        color: colors[idx % colors.length]
      };
    });
  }, [stages, consolidationTasks]);

  // 4. Recent Activity (Real from Tasks)
  const recentActivity = useMemo(() => {
    // Sort by date desc
    const sorted = [...systemTasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted.slice(0, 5).map(task => ({
      type: task.category,
      text: task.title,
      time: format(new Date(task.createdAt), 'dd MMM', { locale: es }), // simplified date
      icon: task.category === 'visit' ? 'person_add' : task.category === 'automation' ? 'smart_toy' : 'task',
      color: task.category === 'visit' ? 'text-blue-400' : 'text-emerald-400'
    }));
  }, [systemTasks]);

  return (
    <Layout title="Panel de Control">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Resumen Ministerial</h1>
            <p className="text-text-secondary text-base font-normal">Métricas de asistencia y salud congregacional.</p>
          </div>
          <div className="flex gap-2">
            {(user?.role === UserRole.ADMIN || user?.role === 'Pastor Principal' || user?.role === UserRole.DISTRICT_SUPERVISOR) && (
              <button
                onClick={() => navigate('/offerings')}
                className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-900/10"
              >
                <span className="material-symbols-outlined text-[18px]">payments</span>
                Ofrendas
              </button>
            )}

          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Miembros Activos"
            value={stats.activeCount}
            trend=""
            icon="how_to_reg"
            color="text-primary"
          />
          <StatCard
            label="Personas Inactivas"
            value={stats.inactiveCount}
            trend=""
            icon="person_off"
            color="text-red-400"
          />
          <StatCard
            label="Células Operativas"
            value={stats.totalCells}
            trend=""
            icon="share"
            color="text-purple-400"
          />
          <StatCard
            label="Células a Multiplicar"
            value={stats.cellsToMultiplyCount}
            trend="> 16 activos"
            icon="rocket_launch"
            // Extreme intensity: double drop-shadow, higher brightness, scale up, vivid orange/red color shift
            color={`${stats.cellsToMultiplyCount >= 1 ? 'text-orange-500 animate-pulse drop-shadow-[0_0_25px_rgba(249,115,22,1)] drop-shadow-[0_0_50px_rgba(234,88,12,0.8)] brightness-200 scale-125 transition-all duration-300' : 'text-orange-400'}`}
            onClick={() => setIsMultiplierModalOpen(true)}
          />

          <StatCard
            label="Edad de la Iglesia"
            value={`${stats.churchAge.average} Años`}
            icon="cake"
            color="text-pink-400"
            onClick={() => setIsAgeModalOpen(true)}
          />

          <StatCard
            label="Control de Tareas"
            value={stats.taskControl.pending}
            trend={`${stats.taskControl.overdue} Vencidas`}
            icon="assignment_late"
            color="text-orange-400"
            onClick={() => navigate('/reports', { state: { tab: 'tasks' } })}
          />

          <StatCard
            label="Timoteos"
            value={stats.timoteoCount}
            trend="Liderazgo en formación"
            icon="school"
            color="text-cyan-400"
            onClick={() => setIsTimoteoModalOpen(true)}
          />
        </div>

        {/* Main Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Weekly Attendance Chart */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div>
                  <h3 className="text-white text-lg font-bold">Asistencia Semanal</h3>
                  <p className="text-text-secondary text-xs">Comparativa real de las últimas 6 semanas</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="flex-1 sm:flex-none bg-[#111822] text-[10px] font-black uppercase tracking-widest text-text-secondary border-border-dark rounded-lg py-1.5 px-3 focus:ring-primary transition-all"
                  >
                    <option value="Todos">Todos los Distritos</option>
                    {districts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-72 w-full">
                {loadingChart ? (
                  <div className="h-full w-full flex items-center justify-center text-text-secondary">
                    Cargando datos...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.map(d => ({
                        ...d,
                        activos: chartActiveBase !== null ? chartActiveBase : stats.activeCount // Use fetched base, or global fallback
                      }))}
                      margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#324867" />
                      <XAxis
                        dataKey="name"
                        xAxisId={0}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#92a9c9', fontSize: 11, fontWeight: 'bold' }}
                      />
                      <XAxis
                        dataKey="name"
                        xAxisId={1}
                        hide
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#92a9c9', fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: '#233348', opacity: 0.4 }}
                        contentStyle={{ backgroundColor: '#192433', border: '1px solid #324867', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ padding: '2px 0' }}
                        labelStyle={{ color: '#fff', marginBottom: '0.5rem' }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        height={36}
                        iconType="circle"
                        formatter={(value) => {
                          if (value.includes('Activos')) return <span className="hidden"></span>;
                          return <span className="text-text-secondary text-[11px] font-bold uppercase ml-1">{value}</span>
                        }}
                      />

                      {/* Background Layer (Activos) - Axis 1 */}
                      <Bar
                        dataKey="activos"
                        name="Total Activos"
                        xAxisId={1}
                        fill="#1f2937"
                        radius={[4, 4, 4, 4]}
                        barSize={20}
                        animationDuration={0}
                      >
                        <LabelList
                          dataKey="activos"
                          position="top"
                          style={{ fill: '#9ca3af', fontSize: '10px', fontWeight: 'bold' }}
                        />
                      </Bar>
                      <Bar
                        dataKey="activos"
                        name="Total Activos "
                        xAxisId={1}
                        fill="#1f2937"
                        radius={[4, 4, 4, 4]}
                        barSize={20}
                        animationDuration={0}
                      >
                        <LabelList
                          dataKey="activos"
                          position="top"
                          style={{ fill: '#9ca3af', fontSize: '10px', fontWeight: 'bold' }}
                        />
                      </Bar>

                      {/* Foreground Layer (Data) - Axis 0 */}
                      <Bar
                        dataKey="celulas"
                        name="Células"
                        xAxisId={0}
                        fill="#136dec"
                        radius={[4, 4, 4, 4]}
                        barSize={20}
                      >
                        <LabelList
                          dataKey="celulas"
                          position="center"
                          style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                          formatter={(val: any) => val > 0 ? val : ''}
                        />
                      </Bar>

                      <Bar
                        dataKey="servicio"
                        name="Servicio"
                        xAxisId={0}
                        fill="#10b981"
                        radius={[4, 4, 4, 4]}
                        barSize={20}
                      >
                        <LabelList
                          dataKey="servicio"
                          position="center"
                          style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                          formatter={(val: any) => val > 0 ? val : ''}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Decade Distribution Chart */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-sm">
              <h3 className="text-white text-lg font-bold mb-6">Demografía por Décadas</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.decadeStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#324867" />
                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#92a9c9', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#92a9c9', fontSize: 11 }} />
                    <Tooltip cursor={{ fill: '#233348', opacity: 0.4 }} contentStyle={{ backgroundColor: '#192433', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="count" name="Personas" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fill: '#92a9c9', fontSize: '10px', fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>



            </div>



          </div>

          {/* Right Column: Stacked Widgets */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* Embudo de Discipulado */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="text-white text-lg font-bold">Embudo de Consolidación</h3>
              <div className="space-y-6 mt-4 overflow-y-auto max-h-[300px] pr-2 custom-audit-scroll">
                {funnelData.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex justify-between text-xs mb-1.5 text-white">
                      <span className="font-bold uppercase tracking-tight text-[10px]">{step.label}</span>
                      <span className="text-text-secondary font-black">{step.value}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`${step.color} h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(19,109,236,0.3)]`} style={{ width: `${step.progress}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>


            </div>

            {/* Gender Distribution Chart */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-sm">
              <h3 className="text-white text-lg font-bold mb-4">Demografía</h3>
              <div className="h-[200px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.genderStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.genderStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text/Labels Legend */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Optional: Center stat or just let legend handle it */}
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                {stats.genderStats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div>
                    <div>
                      <p className="text-white text-sm font-bold">{stat.value}</p>
                      <p className="text-text-secondary text-[10px] uppercase font-bold">{stat.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>



        {/* Actividad Reciente - Hidden for Cell Leaders */}
        {/* District Distribution Chart - Full Width */}
        {/* District Distribution Chart - Full Width */}
        <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-sm">
          <h3 className="text-white text-lg font-bold mb-6">Miembros por Distrito</h3>
          <div className="h-[600px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.districtStats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#324867" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#92a9c9', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={{ fill: '#fff', fontSize: 13, fontWeight: 'bold' }}
                />
                <Tooltip cursor={{ fill: '#233348', opacity: 0.4 }} contentStyle={{ backgroundColor: '#192433', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="value" name="Miembros" radius={[0, 4, 4, 0]} barSize={40}>
                  <LabelList dataKey="value" position="right" style={{ fill: '#fff', fontSize: '13px', fontWeight: 'bold' }} />
                  {stats.districtStats.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#ec4899'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {!isCellLeader && (
          <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-border-dark flex justify-between items-center bg-[#111822]">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span> Últimas Tareas del Sistema
              </h3>
              <button
                onClick={() => setIsAuditModalOpen(true)}
                className="text-primary text-xs font-black uppercase tracking-widest hover:underline px-2 py-1 hover:bg-primary/10 rounded transition-all"
              >
                Auditar Todo
              </button>
            </div>
            <div className="divide-y divide-border-dark">
              {recentActivity.length > 0 ? recentActivity.map((activity, i) => (
                <div key={i} className="p-5 flex items-center gap-4 hover:bg-[#233348]/30 transition-colors cursor-default">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-[#111822] border border-border-dark ${activity.color}`}>
                    <span className="material-symbols-outlined text-[22px]">{activity.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">{activity.text}</p>
                    <p className="text-text-secondary text-[10px] uppercase font-bold">{activity.time}</p>
                  </div>
                  <span className="material-symbols-outlined text-text-secondary opacity-30">chevron_right</span>
                </div>
              )) : (
                <div className="p-8 text-center text-text-secondary text-sm">No hay actividad reciente.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audit Modal (Placeholder logic kept for now) */}
      {
        isAuditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface-dark w-full max-w-2xl rounded-3xl border border-border-dark shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-6 border-b border-border-dark bg-[#111822] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-3xl">list_alt</span>
                  <div>
                    <h2 className="text-white text-xl font-black">Registro de Auditoría</h2>
                    <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest">Actividad Completa de Elevate</p>
                  </div>
                </div>
                <button onClick={() => setIsAuditModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-audit-scroll">
                <div className="p-4 text-center text-text-secondary">
                  La auditoría completa estará disponible próximamente.
                </div>
              </div>
              <div className="p-6 bg-[#111822] border-t border-border-dark flex justify-end gap-3">
                <button onClick={() => setIsAuditModalOpen(false)} className="px-8 py-2 bg-primary text-white rounded-xl text-xs font-black shadow-lg shadow-primary/20">Cerrar</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Cells to Multiply Modal */}
      {
        isMultiplierModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface-dark w-full max-w-md rounded-3xl border border-border-dark shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-6 border-b border-border-dark bg-[#111822] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-orange-400 text-2xl">rocket_launch</span>
                  <div>
                    <h2 className="text-white text-lg font-black">Células a Multiplicar</h2>
                    <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest">
                      {stats.cellsToMultiplyList.length} Células listas (&gt; 16 Activos)
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsMultiplierModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-audit-scroll">
                {stats.cellsToMultiplyList.length > 0 ? (
                  stats.cellsToMultiplyList.map((cell) => {
                    const leader = users.find(u => u.id === cell.leaderId);
                    return (
                      <div key={cell.id} className="bg-[#111822] p-4 rounded-xl border border-border-dark flex flex-col gap-4 group hover:border-orange-500/30 transition-all">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                              <span className="material-symbols-outlined">groups</span>
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{cell.name}</p>
                              <p className="text-text-secondary text-[10px] uppercase">
                                Líder: <span className="text-white font-bold">{leader ? `${leader.firstName} ${leader.lastName}` : 'Sin Asignar'}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-white font-black text-lg">{cell.activeMembers}</span>
                            <span className="text-text-secondary text-[8px] uppercase font-bold">Activos</span>
                          </div>
                        </div>

                        {/* Age Breakdown */}
                        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border-dark/50 w-full">
                          {(() => {
                            // Calculate breakdown on the fly
                            const cellMembers = users.filter(u => u.cellId === cell.id && u.active);
                            let ninos = 0, jovenes = 0, adultos = 0, sinInfo = 0;

                            cellMembers.forEach(m => {
                              if (!m.birthDate) {
                                sinInfo++;
                              } else {
                                const age = differenceInYears(new Date(), parseISO(m.birthDate));
                                if (age <= 12) ninos++;
                                else if (age < 18) jovenes++;
                                else adultos++;
                              }
                            });

                            const items = [
                              { label: 'Niños', sub: '0-12', count: ninos, color: 'text-indigo-400' },
                              { label: 'Jóvenes', sub: '13-17', count: jovenes, color: 'text-cyan-400' },
                              { label: 'Adultos', sub: '18+', count: adultos, color: 'text-emerald-400' },
                              { label: 'Sin Info', sub: '--', count: sinInfo, color: 'text-text-secondary' },
                            ];

                            return items.map((item, idx) => (
                              <div key={idx} className="flex flex-col items-center bg-black/20 rounded-lg p-2">
                                <span className={`text-lg font-black ${item.color}`}>{item.count}</span>
                                <span className="text-[9px] text-text-secondary uppercase font-bold text-center leading-tight">
                                  {item.label}
                                  <br />
                                  <span className="opacity-50 text-[8px]">{item.sub}</span>
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-text-secondary opacity-20">thumb_up</span>
                    <p className="text-text-secondary text-sm font-bold">No hay células listas para multiplicar aún.</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#111822] border-t border-border-dark flex justify-end">
                <button onClick={() => setIsMultiplierModalOpen(false)} className="w-full py-3 bg-surface-dark text-white rounded-xl text-xs font-black border border-border-dark hover:bg-border-dark transition-all">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        .custom-audit-scroll::-webkit-scrollbar { width: 6px; }
        .custom-audit-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-audit-scroll::-webkit-scrollbar-thumb { background: #324867; border-radius: 10px; }
      `}</style>
      <AgeDistributionModal
        isOpen={isAgeModalOpen}
        onClose={() => setIsAgeModalOpen(false)}
        ageData={stats.churchAge.distribution}
        averageAge={stats.churchAge.average}
      />

      {
        isTimoteoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-surface-dark w-full max-w-md rounded-3xl border border-border-dark shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-6 border-b border-border-dark bg-[#111822] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-cyan-400 text-2xl">school</span>
                  <div>
                    <h2 className="text-white text-lg font-black">Timoteos por Célula</h2>
                    <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest">
                      {stats.timoteoCount} Líderes en Formación
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsTimoteoModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 custom-audit-scroll">
                {stats.timoteosByCell.length > 0 ? (
                  stats.timoteosByCell.map((item, idx) => (
                    <div key={idx} className="bg-[#111822] p-4 rounded-xl border border-border-dark flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                          <span className="material-symbols-outlined">groups</span>
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{item.cellName}</p>
                          <p className="text-text-secondary text-[10px] uppercase">
                            {item.leaderName ? `Líder: ${item.leaderName}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-white font-black text-lg">{item.count}</span>
                        <span className="text-text-secondary text-[8px] uppercase font-bold">Timoteos</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-text-secondary opacity-20">school</span>
                    <p className="text-text-secondary text-sm font-bold">No hay Timoteos registrados aún.</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#111822] border-t border-border-dark flex justify-end">
                <button onClick={() => setIsTimoteoModalOpen(false)} className="w-full py-3 bg-surface-dark text-white rounded-xl text-xs font-black border border-border-dark hover:bg-border-dark transition-all">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      }

    </Layout >
  );
};

export default DashboardScreen;
