
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './NotificationContext';
import { UserProvider } from './UserContext';
import { CellProvider } from './CellContext';
import { DistrictProvider } from './DistrictContext';
import { ConsolidationProvider } from './ConsolidationContext';
import { TaskProvider } from './TaskContext';
import { EventProvider } from './EventContext';
import { AnnouncementProvider } from './AnnouncementContext';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import UserListScreen from './screens/UserListScreen';
import UserFormScreen from './screens/UserFormScreen';
import MemberListScreen from './screens/MemberListScreen';
import MemberFormScreen from './screens/MemberFormScreen';
import DistrictListScreen from './screens/DistrictListScreen';
import DistrictFormScreen from './screens/DistrictFormScreen';
import CellListScreen from './screens/CellListScreen';
import CellFormScreen from './screens/CellFormScreen';
import CellAttendanceScreen from './screens/CellAttendanceScreen';
import ConsolidationScreen from './screens/ConsolidationScreen';
import ConsolidationFormScreen from './screens/ConsolidationFormScreen';
import TasksScreen from './screens/TasksScreen';
import ProfileScreen from './screens/ProfileScreen';
import EventsScreen from './screens/EventsScreen';
import AnnouncementsAdminScreen from './screens/AnnouncementsAdminScreen';
import WelcomeScreen from './screens/WelcomeScreen';

import ReportsScreen from './screens/ReportsScreen';
import OfferingReportScreen from './screens/OfferingReportScreen';
import ErrorBoundary from './components/ErrorBoundary';

const WrappedMemberListScreen = () => (
  <ErrorBoundary>
    <MemberListScreen />
  </ErrorBoundary>
);

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <ErrorBoundary>
        <UserProvider>
          <CellProvider>
            <DistrictProvider>
              <TaskProvider>
                <ConsolidationProvider>
                  <EventProvider>
                    <AnnouncementProvider>
                      <Router>
                        <Routes>
                          <Route path="/" element={<LoginScreen />} />
                          <Route path="/dashboard" element={<DashboardScreen />} />

                          {/* Events */}
                          <Route path="/events" element={<EventsScreen />} />

                          {/* Reports */}
                          <Route path="/reports" element={<ReportsScreen />} />
                          <Route path="/offerings" element={<OfferingReportScreen />} />

                          {/* Users */}
                          <Route path="/users" element={<UserListScreen />} />
                          <Route path="/users/create" element={<UserFormScreen mode="create" />} />
                          <Route path="/users/edit/:id" element={<UserFormScreen mode="edit" />} />

                          {/* Members */}
                          <Route path="/members" element={<WrappedMemberListScreen />} />
                          <Route path="/members/create" element={<MemberFormScreen mode="create" />} />
                          <Route path="/members/edit/:id" element={<MemberFormScreen mode="edit" />} />

                          {/* Districts */}
                          <Route path="/districts" element={<DistrictListScreen />} />
                          <Route path="/districts/create" element={<DistrictFormScreen mode="create" />} />
                          <Route path="/districts/edit/:id" element={<DistrictFormScreen mode="edit" />} />

                          {/* Cells */}
                          <Route path="/cells" element={<CellListScreen />} />
                          <Route path="/cells/create" element={<CellFormScreen mode="create" />} />
                          <Route path="/cells/edit/:id" element={<CellFormScreen mode="edit" />} />
                          <Route path="/cells/attendance/:id" element={<CellAttendanceScreen />} />

                          {/* Consolidation */}
                          <Route path="/consolidation" element={<ConsolidationScreen />} />
                          <Route path="/consolidation/create" element={<ConsolidationFormScreen mode="create" />} />
                          <Route path="/consolidation/edit/:id" element={<ConsolidationFormScreen mode="edit" />} />

                          {/* Other */}
                          <Route path="/tasks" element={<TasksScreen />} />
                          <Route path="/profile" element={<ProfileScreen />} />

                          {/* Announcements */}
                          <Route path="/welcome" element={<WelcomeScreen />} />
                          <Route path="/announcements" element={<AnnouncementsAdminScreen />} />

                          <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </Router>
                    </AnnouncementProvider>
                  </EventProvider>
                </ConsolidationProvider>
              </TaskProvider>
            </DistrictProvider>
          </CellProvider>
        </UserProvider>
      </ErrorBoundary>
    </NotificationProvider >
  );
};

export default App;
