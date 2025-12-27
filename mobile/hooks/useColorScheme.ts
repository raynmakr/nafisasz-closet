import { useColorScheme as useRNColorScheme } from 'react-native';
import { Colors, ThemeColors } from '@/constants/colors';

export function useColorScheme(): 'light' | 'dark' {
  const colorScheme = useRNColorScheme();
  return colorScheme ?? 'light';
}

export function useThemeColors(): ThemeColors {
  const colorScheme = useRNColorScheme();
  return Colors[colorScheme ?? 'light'];
}
