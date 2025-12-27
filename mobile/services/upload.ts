import { api } from './api';

export interface UploadResult {
  success: boolean;
  url: string;
  publicId: string;
}

/**
 * Convert a local file URI to base64
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

export const uploadService = {
  /**
   * Upload a single image to Cloudinary
   * @param imageUri - Local file URI from image picker
   * @returns Promise with the uploaded image URL
   */
  async uploadImage(imageUri: string): Promise<string> {
    // Convert file to base64 data URI
    const dataUri = await fileToBase64(imageUri);

    // Upload to API (60 second timeout for large images)
    const result = await api.post<UploadResult>('/upload', { image: dataUri }, { timeout: 60000 });

    if (!result.success || !result.url) {
      throw new Error('Upload failed');
    }

    return result.url;
  },

  /**
   * Upload multiple images sequentially
   * @param imageUris - Array of local file URIs
   * @param onProgress - Optional callback for progress updates
   * @returns Promise with array of uploaded image URLs
   */
  async uploadImages(
    imageUris: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const urls: string[] = [];
    let completed = 0;

    // Upload images sequentially to avoid overwhelming the server
    for (const uri of imageUris) {
      const url = await this.uploadImage(uri);
      urls.push(url);
      completed++;
      onProgress?.(completed, imageUris.length);
    }

    return urls;
  },
};
