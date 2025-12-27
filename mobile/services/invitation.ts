import { api } from './api';
import { InvitationInfo, InvitationValidation } from '@/types';

export const invitationService = {
  async getInvitationInfo(): Promise<InvitationInfo> {
    return api.get<InvitationInfo>('/user/invitation');
  },

  async validateCode(code: string): Promise<InvitationValidation> {
    return api.get<InvitationValidation>('/invitation/validate', { code });
  },
};
