import { useWindowDimensions } from 'react-native';
import { usePresentationLanguage } from './use-presentation-language';
import { arabicComposition } from '@/utils/arabic-composition';
export function useArabicComposition() {
  const {width, fontScale} = useWindowDimensions();
  return {active: usePresentationLanguage() === 'ar', ...arabicComposition(width, fontScale)};
}
