import { api } from './api';
import { UserClaim } from '@/types';

interface BidsResponse {
  bids: UserClaim[];
}

export const bidsService = {
  async getMyClaims(): Promise<UserClaim[]> {
    const response = await api.get<BidsResponse>('/bids');
    return response.bids || [];
  },
};
