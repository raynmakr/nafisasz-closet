import { api } from './api';
import { Listing, Curator } from '@/types';

export interface ParsedQuery {
  keywords: string[];
  maxPrice?: number | null;
  minPrice?: number | null;
  brand?: string | null;
  category?: string | null;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  style?: string | null;
}

export interface AutocompleteSuggestion {
  type: 'hashtag' | 'handle' | 'brand';
  value: string;
  count?: number;
  displayName?: string;
}

export interface SearchResult {
  query: string;
  listings?: {
    results: Listing[];
    total: number;
  };
  curators?: {
    results: Curator[];
    total: number;
  };
  aiParsed?: ParsedQuery | null;
}

export interface SearchParams {
  query: string;
  type?: 'all' | 'listings' | 'curators';
  limit?: number;
  offset?: number;
  maxPrice?: number;
  minPrice?: number;
  useAI?: boolean;
}

export const searchService = {
  /**
   * Unified search across listings and curators
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const queryParams: Record<string, string> = {
      q: params.query,
    };

    if (params.type) queryParams.type = params.type;
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.offset) queryParams.offset = params.offset.toString();
    if (params.maxPrice) queryParams.maxPrice = params.maxPrice.toString();
    if (params.minPrice) queryParams.minPrice = params.minPrice.toString();
    if (params.useAI) queryParams.ai = 'true';

    return api.get<SearchResult>('/search', queryParams);
  },

  /**
   * Get autocomplete suggestions for search input
   */
  async autocomplete(query: string, limit = 10): Promise<AutocompleteSuggestion[]> {
    if (!query || query.length < 2) return [];

    try {
      const response = await api.get<{ suggestions: AutocompleteSuggestion[] }>(
        '/search/autocomplete',
        { q: query, limit: limit.toString() }
      );
      return response.suggestions || [];
    } catch {
      return [];
    }
  },

  /**
   * Parse a natural language query using AI
   */
  async parseQueryWithAI(query: string): Promise<ParsedQuery | null> {
    if (!query || query.length < 2) return null;

    try {
      const response = await api.post<{ success: boolean; data: ParsedQuery }>(
        '/ai/parse-search',
        { query },
        { timeout: 10000 }
      );

      if (response.success) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  },
};
