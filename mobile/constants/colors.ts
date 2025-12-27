// Deep purple background, white text, red accent
export const Colors = {
  light: {
    primary: '#FFFFFF',
    secondary: '#2D1B4E',
    accent: '#E63946',
    background: '#1A0A2E',
    surface: '#2D1B4E',
    text: '#FFFFFF',
    textSecondary: '#B8A9C9',
    textMuted: '#8B7A9E',
    border: '#3D2B5E',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#E63946',
    info: '#3B82F6',
  },
  dark: {
    primary: '#FFFFFF',
    secondary: '#2D1B4E',
    accent: '#E63946',
    background: '#1A0A2E',
    surface: '#2D1B4E',
    text: '#FFFFFF',
    textSecondary: '#B8A9C9',
    textMuted: '#8B7A9E',
    border: '#3D2B5E',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#E63946',
    info: '#3B82F6',
  },
};

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = typeof Colors.light;
