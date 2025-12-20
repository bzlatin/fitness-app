import { apiClient } from './client';
import { GymPreferences } from '../types/gym';

export const fetchGymPreferences = async (): Promise<GymPreferences> => {
  const res = await apiClient.get<{ gymPreferences: GymPreferences }>('/user/gym-preferences');
  return res.data.gymPreferences;
};

export const updateGymPreferences = async (
  payload: GymPreferences
): Promise<GymPreferences> => {
  const res = await apiClient.put<{ gymPreferences: GymPreferences }>(
    '/user/gym-preferences',
    payload
  );
  return res.data.gymPreferences;
};
