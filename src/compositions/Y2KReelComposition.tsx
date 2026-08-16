import React from 'react';
import { AbsoluteFill, Video, Img, useCurrentFrame } from 'remotion';
import { FitMode, TemplateFitMode, PhotoRegion, Y2KEffects } from '../types';

export interface Y2KReelProps {
  photoUrl: string;
  templateSource: string;
  templateType: 'video' | 'image';
  photoRegion: PhotoRegion;
  templateRegion: PhotoRegion;
  photoFitMode: FitMode;
  templateFitMode: TemplateFitMode;
  effects: Y2KEffects;
  photoXOffset?: number;
  templateXOffset?: number;
}

// Deterministic pseudo-random generator
const randomFromFrame = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const Y2KReelComposition: React.FC<Y2KReelProps> = ({
  photoUrl,
  templateSource,
  templateType,
  photoRegion,
  templateRegion,
  photoFitMode,
  templateFitMode,
  effects,
  photoXOffset = 0,
  templateXOffset = 0,
}) => {
  const frame = useCurrentFrame();

  // Convert decimal ratios to percentage strings
  const getStyleFromRegion = (r: PhotoRegion) => ({
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.width * 100}%`,
    height: `${r.height * 100}%`,
    position: 'absolute' as const,
  });

  const photoStyle = {
    ...getStyleFromRegion(photoRegion),
    objectFit: photoFitMode === 'STRETCH' ? 'fill' as const : photoFitMode === 'CROP' ? 'cover' as const : 'contain' as const,
    objectPosition: `${50 + photoXOffset}% 50%`,
  };

  const templateStyle = {
    ...getStyleFromRegion(templateRegion),
    objectFit: templateFitMode === 'stretch' ? 'fill' as const : templateFitMode === 'fill' ? 'cover' as const : 'contain' as const,
    objectPosition: `${50 + templateXOffset}% 50%`,
  };

  // Determine frame jitter displacement
  let jitterX = 0;
  let jitterY = 0;
  if (effects.jitter && effects.jitter.enabled) {
    const jitterChance = randomFromFrame(frame * 1.83);
    if (jitterChance < 0.25) {
      jitterX = (randomFromFrame(frame * 3.42) - 0.5) * effects.jitter.intensity * 40;
      jitterY = (randomFromFrame(frame * 5.71) - 0.5) * effects.jitter.intensity * 40;
    }
  }

  // Determine VHS static noise band vertical position
  let noiseBandY = 0;
  if (effects.vhsNoise && effects.vhsNoise.enabled) {
    noiseBandY = Math.floor(randomFromFrame(Math.floor(frame / 10)) * 1920);
  }

  const containerStyle: React.CSSProperties = {
    width: '1080px',
    height: '1920px',
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    transform: `translate(${jitterX}px, ${jitterY}px)`,
    filter: effects.chromaticAberration && effects.chromaticAberration.enabled
      ? `url(#chromatic-filter-${frame})`
      : undefined,
  };

  // Color Degradation styles
  const overlayFiltersStyle: React.CSSProperties = {
    filter: effects.colorDegradation && effects.colorDegradation.enabled
      ? `saturate(${effects.colorDegradation.saturation}) contrast(${effects.colorDegradation.contrast}) brightness(${effects.colorDegradation.brightness})`
      : undefined,
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={containerStyle}>
        {/* SVG filter for Chromatic Aberration (offsets red and cyan) */}
        {effects.chromaticAberration && effects.chromaticAberration.enabled && (
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <filter id={`chromatic-filter-${frame}`}>
                <feColorMatrix
                  type="matrix"
                  values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                  in="SourceGraphic"
                  result="redChannel"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
                  in="SourceGraphic"
                  result="cyanChannel"
                />
                <feOffset
                  dx={effects.chromaticAberration.offset}
                  dy={0}
                  in="redChannel"
                  result="redShifted"
                />
                <feOffset
                  dx={-effects.chromaticAberration.offset}
                  dy={0}
                  in="cyanChannel"
                  result="cyanShifted"
                />
                <feBlend
                  mode="screen"
                  in="redShifted"
                  in2="cyanShifted"
                  result="aberration"
                />
              </filter>
            </defs>
          </svg>
        )}

        {/* 1. Background layer */}
        <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: '#050505', zIndex: 0 }} />

        {/* 2. Photo Layer */}
        {photoUrl && (
          <Img
            src={photoUrl}
            style={photoStyle}
          />
        )}

        {/* 3. Template Layer */}
        {templateSource && (
          templateType === 'video' ? (
            <Video
              src={templateSource}
              style={templateStyle}
              muted
              loop
            />
          ) : (
            <Img
              src={templateSource}
              style={templateStyle}
            />
          )
        )}

        {/* 4. Color Grading Overlay */}
        <div style={overlayFiltersStyle} />

        {/* 5. Y2K Scanlines Overlay */}
        {effects.scanlines && effects.scanlines.enabled && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              background: `repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, ${effects.scanlines.intensity * 0.45}) 0px,
                rgba(0, 0, 0, ${effects.scanlines.intensity * 0.45}) 2px,
                transparent 2px,
                transparent 4px
              )`,
              zIndex: 10,
            }}
          />
        )}

        {/* 6. Dynamic Film Grain Layer */}
        {effects.grain && effects.grain.enabled && (
          <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 11 }}>
            <defs>
              <filter id={`grain-filter-${frame}`}>
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.55"
                  numOctaves="1"
                  seed={frame}
                />
                <feColorMatrix
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0"
                />
              </filter>
            </defs>
            <rect
              width="100%"
              height="100%"
              filter={`url(#grain-filter-${frame})`}
              opacity={effects.grain.intensity}
              style={{ mixBlendMode: 'overlay' }}
            />
          </svg>
        )}

        {/* 7. VHS Noise glitch bars overlay */}
        {effects.vhsNoise && effects.vhsNoise.enabled && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 12,
              overflow: 'hidden',
            }}
          >
            {/* Horizontal scanning noise band */}
            <div
              style={{
                position: 'absolute',
                top: `${(frame * 6) % 1920}px`,
                left: 0,
                width: '100%',
                height: `${20 + randomFromFrame(frame * 4.9) * 40}px`,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                boxShadow: `0 0 15px 5px rgba(255, 255, 255, ${effects.vhsNoise.intensity * 0.25})`,
                filter: 'blur(2px)',
              }}
            />
            {/* Dynamic white/gray static line */}
            <div
              style={{
                position: 'absolute',
                top: `${noiseBandY}px`,
                left: 0,
                width: '100%',
                height: '2px',
                backgroundColor: `rgba(255, 255, 255, ${effects.vhsNoise.intensity * 0.6})`,
                filter: 'blur(1px)',
              }}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
