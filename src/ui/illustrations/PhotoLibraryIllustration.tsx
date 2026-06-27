import React from 'react';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
interface IllustrationProps {
  size?: number;
}

export const PhotoLibraryIllustration = React.memo(({ size = 64 }: IllustrationProps) => {
  const colors = useMaterialColors();
  
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Background abstract shapes */}
      <Circle cx="32" cy="32" r="28" fill={colors.primary} fillOpacity={0.05} />
      
      {/* Back photo frame */}
      <Rect x="12" y="12" width="34" height="34" rx="4" fill={colors.primary} fillOpacity={0.15} stroke={colors.primary} strokeWidth="2" />
      
      {/* Front photo frame */}
      <Rect x="18" y="18" width="34" height="34" rx="4" fill={colors.secondaryContainer} stroke={colors.primary} strokeWidth="2.5" />
      
      {/* Mountain/Sun Landscape inside front photo */}
      <Circle cx="28" cy="28" r="4.5" fill={colors.primary} fillOpacity={0.8} />
      <Path 
        d="M18 45 L28 32 L34 38 L42 26 L52 40" 
        stroke={colors.primary} 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none" 
      />
      
      {/* Star / Sparkle representing 'All' or 'Magic' */}
      <Path 
        d="M50 8 L52.5 15 L60 17.5 L52.5 20 L50 27 L47.5 20 L40 17.5 L47.5 15 Z" 
        fill={colors.primary} 
      />
      <Path 
        d="M12 45 L13 49 L17 50 L13 51 L12 55 L11 51 L7 50 L11 49 Z" 
        fill={colors.primary} 
        fillOpacity={0.6}
      />
    </Svg>
  );
});
