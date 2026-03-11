import { v4 as uuidv4 } from 'uuid';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { api } from './lib/api';
import { useNotification } from './NotificationContext';

interface UserContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  users: User[];
  addUser: (user: Omit<User, 'id' | 'joinDate' | 'active'>, password?: string) => Promise<string | undefined>;
  updateUser: (id: string, updates: Partial<User>, password?: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();

  useEffect(() => {
    initSession();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const initSession = async () => {
    const sessionStr = localStorage.getItem('session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        // Verify token validity or just load profile
        const profile = await api.get(`/profile/${session.user.id}`);
        if (profile) {
          setUser(mapProfileToUser(profile));
        } else {
          logout();
        }
      } catch (err) {
        console.error("Session invalid", err);
        logout();
      }
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('session');
    setUser(null);
    setUsers([]);
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get('/profiles');
      setUsers(data.map(mapProfileToUser));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const mapProfileToUser = (data: any): User => ({
    id: data.id,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    email: data.email || '',
    role: (data.role as UserRole) || UserRole.MEMBER,
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

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.post('/login', { email, password });
      localStorage.setItem('session', JSON.stringify(response.session));

      const profile = await api.get(`/profile/${response.session.user.id}`);
      setUser(mapProfileToUser(profile));
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    logout();
  };

  const addUser = async (userData: Omit<User, 'id' | 'joinDate' | 'active'>, password?: string) => {
    // Logic split:
    // If password provided -> /signup (Create User + Profile)
    // If no password -> /profiles (Create Profile only)

    try {
      if (password) {
        // Signup logic
        const response = await api.post('/signup', {
          email: userData.email,
          password: password,
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            role: userData.role,
            district_id: userData.districtId,
            cell_id: userData.cellId
          }
        });

        // Update extended profile data manually if needed, or send all in signup
        // For simplicity, we just created basic profile in /signup. 
        // We can do a subsequent update for the rest of fields.
        const newUserId = response.session.user.id;
        await updateUser(newUserId, userData as any); // Cast to update rest

        showNotification("Usuario del sistema creado exitosamente.", 'success');
        await fetchUsers();
        return newUserId;

      } else {
        // Simple Member Add
        const newUserId = uuidv4();
        // Handle optional email: send null if empty to avoid UNIQUE constraint violation
        const sanitizedEmail = userData.email && userData.email.trim() !== '' ? userData.email : null;

        const payload = {
          id: newUserId,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: sanitizedEmail,
          role: userData.role,
          active: true,
          image_url: userData.imageUrl,
          district_id: userData.districtId,
          cell_id: userData.cellId,
          birth_date: userData.birthDate,
          marital_status: userData.maritalStatus,
          gender: userData.gender,
          profession: userData.profession,
          address: userData.address,
          phone: userData.phone,
          consolidation_stage_id: userData.consolidationStageId,
          conversion_origin: userData.conversionOrigin,
          conversion_event_id: userData.conversionEventId
        };

        await api.post('/profiles', payload);
        showNotification("Ficha de miembro creada correctamente.", 'success');
        await fetchUsers();
        return newUserId;
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('unique') && msg.includes('email')) {
        showNotification("El correo electrónico ya está registrado. Si el miembro no tiene correo, deje el campo vacío.", 'error');
      } else {
        showNotification(`Error al crear usuario: ${msg}`, 'error');
      }
    }
  };

  const updateUser = async (id: string, updates: Partial<User>, password?: string) => {
    try {
      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.active !== undefined) dbUpdates.active = updates.active;
      if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
      if (updates.districtId !== undefined) dbUpdates.district_id = updates.districtId;
      if (updates.cellId !== undefined) dbUpdates.cell_id = updates.cellId;
      if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
      if (updates.maritalStatus !== undefined) dbUpdates.marital_status = updates.maritalStatus;
      if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
      if (updates.profession !== undefined) dbUpdates.profession = updates.profession;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.consolidationStageId !== undefined) dbUpdates.consolidation_stage_id = updates.consolidationStageId;
      if (updates.conversionOrigin !== undefined) dbUpdates.conversion_origin = updates.conversionOrigin;
      if (updates.conversionEventId !== undefined) dbUpdates.conversion_event_id = updates.conversionEventId;
      if (updates.email !== undefined) {
        dbUpdates.email = updates.email && updates.email.trim() !== '' ? updates.email : null;
      }

      await api.patch(`/profiles/${id}`, dbUpdates);

      // OPTIMISTIC UPDATE: Update local state immediately
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      if (user?.id === id) {
        setUser(prev => prev ? { ...prev, ...updates } : null);
      }

      if (password && password.trim() !== '') {
        // Note: Password update not implemented in this simple API version yet
        console.warn("Password update not implemented in this demo API");
        showNotification("Datos actualizados. (Cambio de contraseña no disponible en esta versión)", 'warning');
      } else {
        showNotification("Usuario actualizado correctamente", 'success');
      }

      await fetchUsers();
      if (user?.id === id) {
        // Refresh self
        const profile = await api.get(`/profile/${id}`);
        setUser(mapProfileToUser(profile));
      }

    } catch (error: any) {
      console.error("Error updating user:", error);
      showNotification(`Error al actualizar: ${error.message}`, 'error');
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await api.delete(`/profiles/${id}`);
      // OPTIMISTIC UPDATE: Remove from local state immediately
      setUsers(prev => prev.filter(u => u.id !== id));

      // showNotification("Miembro eliminado correctamente.", 'success'); // Let UI handle success to avoid double toasts
      fetchUsers();
    } catch (error: any) {
      console.error("Delete operation failed:", error);
      showNotification(`Error al eliminar: ${error.message}`, 'error');
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, signIn, signOut, users, addUser, updateUser, deleteUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsers = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUsers must be used within a UserProvider');
  return context;
};
