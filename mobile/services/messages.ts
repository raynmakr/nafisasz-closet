import { api } from './api';

export interface Message {
  id: string;
  text: string;
  senderId: number;
  senderName?: string;
  senderAvatar?: string;
  createdAt: string;
  read: boolean;
}

export interface Conversation {
  listing_id: number;
  listing_title: string;
  listing_photos: string[];
  curator_user_id: number;
  curator_name: string;
  other_user_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface MessagesResponse {
  messages: Message[];
  listing: {
    id: number;
    title: string;
    photo: string;
    curatorUserId: number;
  };
  otherUser: {
    id: number;
    name: string;
    avatar_url?: string;
  } | null;
}

export interface DMConversation {
  user_id: number;
  user_name: string;
  user_handle?: string;
  user_avatar?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface UserSearchResult {
  id: number;
  name: string;
  handle?: string;
  avatar_url?: string;
}

export const messagesService = {
  // Listing-based messages
  async getConversations(): Promise<Conversation[]> {
    const response = await api.get<{ conversations: Conversation[] }>('/messages');
    return response.conversations || [];
  },

  async getMessages(listingId: string): Promise<MessagesResponse> {
    const response = await api.get<MessagesResponse>('/messages', { listingId });
    return response;
  },

  async sendMessage(listingId: string, text: string): Promise<Message> {
    const response = await api.post<{ success: boolean; message: Message }>('/messages', {
      listingId,
      text,
    });
    return response.message;
  },

  async markAsRead(listingId: string): Promise<void> {
    await api.put('/messages', { action: 'mark-read', listingId });
  },

  // Direct messages (user-to-user)
  async getDMConversations(): Promise<DMConversation[]> {
    const response = await api.get<{ conversations: DMConversation[] }>('/messages/dm');
    return response.conversations || [];
  },

  async getDMMessages(userId: string): Promise<{ messages: Message[] }> {
    const response = await api.get<{ messages: Message[] }>('/messages/dm', { userId });
    return response;
  },

  async sendDM(userId: string, text: string): Promise<Message> {
    const response = await api.post<{ success: boolean; message: Message }>('/messages/dm', {
      userId,
      text,
    });
    return response.message;
  },

  async markDMAsRead(userId: string): Promise<void> {
    await api.put('/messages/dm', { action: 'mark-read', userId });
  },

  // User search for new conversations
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const response = await api.get<{ users: UserSearchResult[] }>('/users/search', { q: query });
    return response.users || [];
  },
};
