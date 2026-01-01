import { api } from './api';

export interface ProductAnalysisResult {
  title: string | null;
  brand: string | null;
  description: string | null;
  tags: string[];
}

export interface TagAnalysisResult {
  price: number | null;
  size: string | null;
  currency: 'USD' | 'GBP' | 'EUR' | 'CAD' | null;
  confidence: 'high' | 'medium' | 'low';
}

interface AnalyzeProductResponse {
  success: boolean;
  data: ProductAnalysisResult;
}

interface AnalyzeTagResponse {
  success: boolean;
  data: TagAnalysisResult;
}

/**
 * Convert a local file URI to base64 data URI
 */
async function fileToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const aiService = {
  /**
   * Analyze a product photo to extract title, brand, and description
   * @param imageUrl - Cloudinary URL of the uploaded image
   * @returns Promise with extracted product data
   */
  async analyzeProduct(imageUrl: string): Promise<ProductAnalysisResult> {
    const response = await api.post<AnalyzeProductResponse>(
      '/ai/analyze-product',
      { imageUrl },
      { timeout: 30000 }
    );

    if (!response.success) {
      throw new Error('Failed to analyze product');
    }

    return response.data;
  },

  /**
   * Analyze a tag/label photo to extract price and size
   * @param imageUri - Local file URI from camera
   * @returns Promise with extracted tag data
   */
  async analyzeTag(imageUri: string): Promise<TagAnalysisResult> {
    const imageBase64 = await fileToBase64(imageUri);

    const response = await api.post<AnalyzeTagResponse>(
      '/ai/analyze-tag',
      { imageBase64 },
      { timeout: 30000 }
    );

    if (!response.success) {
      throw new Error('Failed to analyze tag');
    }

    return response.data;
  },
};
