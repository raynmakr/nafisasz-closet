import { api } from './api';
import { ApiResponse, PaginatedResponse, Curator } from '@/types';

export interface CuratorsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const curatorsService = {
  async getCurators(params?: CuratorsQueryParams): Promise<PaginatedResponse<Curator>> {
    return api.get<PaginatedResponse<Curator>>('/curators', params as Record<string, unknown>);
  },

  async getCurator(id: string): Promise<Curator & { following?: boolean }> {
    const response = await api.get<{ curator: Curator; following: boolean }>('/curators', { id });
    return { ...response.curator, following: response.following };
  },

  async followCurator(curatorUserId: string): Promise<void> {
    await api.post('/curators', { curatorUserId });
  },

  async unfollowCurator(curatorUserId: string): Promise<void> {
    await api.delete('/curators', { curatorUserId });
  },

  async becomeCurator(): Promise<void> {
    await api.post('/curators', { action: 'become' });
  },

  async getFollowedCurators(): Promise<Curator[]> {
    const response = await api.get<{ curators: Curator[] }>('/curators', { following: 'true' });
    return response.curators || [];
  },
};
