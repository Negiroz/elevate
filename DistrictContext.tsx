import React, { createContext, useContext, useState, useEffect } from 'react';
import { District } from './types';
import { api } from './lib/api';

interface DistrictContextType {
  districts: District[];
  loading: boolean;
  addDistrict: (district: Omit<District, 'id' | 'cellCount'>) => Promise<void>;
  updateDistrict: (id: string, updates: Partial<District>) => Promise<void>;
  deleteDistrict: (id: string) => Promise<void>;
}

const DistrictContext = createContext<DistrictContextType | undefined>(undefined);

import { useUsers } from './UserContext';

// ... imports

export const DistrictProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUsers();

  useEffect(() => {
    if (user) {
      fetchDistricts();
    }
  }, [user]);

  const fetchDistricts = async () => {
    try {
      const data = await api.get('/districts');
      setDistricts(data.map(mapDbToDistrict));
    } catch (error) {
      console.error('Error fetching districts:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapDbToDistrict = (data: any): District => ({
    id: data.id,
    name: data.name,
    supervisorId: data.supervisor_id || '',
    cellCount: data.cells?.[0]?.count || 0,
    active: data.active === 1 || data.active === true,
    color: data.color || '#3B82F6'
  });

  const addDistrict = async (data: Omit<District, 'id' | 'cellCount'>) => {
    try {
      await api.post('/districts', {
        name: data.name,
        supervisor_id: data.supervisorId,
        active: data.active,
        color: data.color
      });
      await fetchDistricts();
    } catch (error) {
      console.error('Error adding district:', error);
    }
  };

  const updateDistrict = async (id: string, updates: Partial<District>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.supervisorId !== undefined) dbUpdates.supervisor_id = updates.supervisorId;
      if (updates.active !== undefined) dbUpdates.active = updates.active;
      if (updates.color !== undefined) dbUpdates.color = updates.color;

      await api.patch(`/districts/${id}`, dbUpdates);
      await fetchDistricts();
    } catch (error) {
      console.error('Error updating district:', error);
    }
  };

  const deleteDistrict = async (id: string) => {
    try {
      await api.delete(`/districts/${id}`);
      setDistricts(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting district:', error);
    }
  };

  return (
    <DistrictContext.Provider value={{ districts, loading, addDistrict, updateDistrict, deleteDistrict }}>
      {children}
    </DistrictContext.Provider>
  );
};

export const useDistricts = () => {
  const context = useContext(DistrictContext);
  if (!context) throw new Error('useDistricts must be used within a DistrictProvider');
  return context;
};
