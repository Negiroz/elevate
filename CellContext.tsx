import React, { createContext, useContext, useState, useEffect } from 'react';
import { Cell } from './types';
import { api } from './lib/api';

interface CellContextType {
  cells: Cell[];
  loading: boolean;
  addCell: (cell: Omit<Cell, 'id'>) => Promise<void>;
  updateCell: (id: string, updates: Partial<Cell>) => Promise<void>;
  deleteCell: (id: string) => Promise<void>;
}

const CellContext = createContext<CellContextType | undefined>(undefined);

import { useUsers } from './UserContext';

// ... imports

export const CellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUsers();

  useEffect(() => {
    if (user) {
      fetchCells();
    }
  }, [user]);

  const fetchCells = async () => {
    try {
      const data = await api.get('/cells');
      setCells(data.map(mapDbToCell));
    } catch (error) {
      console.error('Error fetching cells:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapDbToCell = (data: any): Cell => ({
    id: data.id,
    name: data.name,
    leaderId: data.leader_id || '',
    districtId: data.district_id || '',
    memberCount: data.profiles?.[0]?.count || 0,
    imageUrl: data.image_url,
    meetingDay: data.meeting_day
  });

  const addCell = async (cellData: Omit<Cell, 'id'>) => {
    try {
      await api.post('/cells', {
        name: cellData.name,
        leader_id: cellData.leaderId,
        district_id: cellData.districtId,
        image_url: cellData.imageUrl || `https://picsum.photos/seed/${Math.random()}/400/200`,
        meeting_day: cellData.meetingDay
      });
      await fetchCells();
    } catch (error) {
      console.error('Error adding cell:', error);
    }
  };

  const updateCell = async (id: string, updates: Partial<Cell>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.leaderId !== undefined) dbUpdates.leader_id = updates.leaderId;
      if (updates.districtId !== undefined) dbUpdates.district_id = updates.districtId;
      if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
      if (updates.meetingDay !== undefined) dbUpdates.meeting_day = updates.meetingDay;

      await api.patch(`/cells/${id}`, dbUpdates);
      await fetchCells();
    } catch (error) {
      console.error('Error updating cell:', error);
    }
  };

  const deleteCell = async (id: string) => {
    try {
      await api.delete(`/cells/${id}`);
      setCells(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting cell:', error);
    }
  };

  return (
    <CellContext.Provider value={{ cells, loading, addCell, updateCell, deleteCell }}>
      {children}
    </CellContext.Provider>
  );
};

export const useCells = () => {
  const context = useContext(CellContext);
  if (!context) throw new Error('useCells must be used within a CellProvider');
  return context;
};
