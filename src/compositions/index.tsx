import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { Y2KReelComposition } from './Y2KReelComposition';
import { DEFAULT_EFFECTS } from '../store';

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Y2KReel"
        component={Y2KReelComposition as any}
        durationInFrames={150} // Default duration: 5 seconds at 30 FPS
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          photoUrl: '',
          templateSource: '',
          templateType: 'video' as const,
          photoRegion: { x: 0.0, y: 0.0, width: 0.5, height: 1.0 },
          templateRegion: { x: 0.5, y: 0.0, width: 0.5, height: 1.0 },
          photoFitMode: 'STRETCH' as const,
          templateFitMode: 'fill' as const,
          effects: DEFAULT_EFFECTS,
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
export default RemotionRoot;
