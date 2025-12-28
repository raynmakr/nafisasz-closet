import { api } from './api';

export interface HuntStory {
  id: number;
  curatorId: number;
  curatorName: string;
  curatorHandle: string;
  curatorAvatar: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  location: string | null;
  duration: number;
  viewCount: number;
  viewed: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface StoryCurator {
  curatorId: number;
  curatorUserId: number;
  curatorName: string;
  curatorHandle: string;
  curatorAvatar: string | null;
  stories: HuntStory[];
  hasUnwatched: boolean;
}

export interface CreateStoryInput {
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  location?: string;
  duration?: number;
}

export const storiesService = {
  /**
   * Get all active stories grouped by curator
   */
  async getStories(): Promise<StoryCurator[]> {
    const response = await api.get<{ curators: StoryCurator[] }>('/stories');
    return response.curators;
  },

  /**
   * Get stories for a specific curator
   */
  async getCuratorStories(curatorId: number): Promise<HuntStory[]> {
    const response = await api.get<{ stories: HuntStory[] }>(`/stories?curatorId=${curatorId}`);
    return response.stories;
  },

  /**
   * Create a new story
   */
  async createStory(input: CreateStoryInput): Promise<HuntStory> {
    const response = await api.post<{ success: boolean; story: HuntStory }>('/stories', input);
    return response.story;
  },

  /**
   * Record that user viewed a story
   */
  async recordView(storyId: number): Promise<void> {
    await api.post('/stories', { action: 'view', storyId });
  },

  /**
   * Delete a story (curator only)
   */
  async deleteStory(storyId: number): Promise<void> {
    await api.delete(`/stories?id=${storyId}`);
  },
};
