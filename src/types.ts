export type FitMode = 'STRETCH' | 'CROP' | 'CONTAIN';
export type TemplateFitMode = 'fill' | 'fit' | 'stretch';

export interface PhotoRegion {
  x: number;      // decimal ratio (0.0 to 1.0)
  y: number;      // decimal ratio (0.0 to 1.0)
  width: number;  // decimal ratio (0.0 to 1.0)
  height: number; // decimal ratio (0.0 to 1.0)
}

export interface Y2KEffects {
  grain: { enabled: boolean; intensity: number };
  vhsNoise: { enabled: boolean; intensity: number };
  scanlines: { enabled: boolean; intensity: number };
  chromaticAberration: { enabled: boolean; offset: number };
  colorDegradation: { enabled: boolean; saturation: number; contrast: number; brightness: number };
  jitter: { enabled: boolean; intensity: number };
}

export interface TemplateConfig {
  id: string;
  name: string;
  templateSource: string; // URL or local path
  templateType: 'video' | 'image';
  canvasWidth: number;   // default 1080
  canvasHeight: number;  // default 1920
  fps: number;           // default 30
  durationSeconds: number; // default 5 or template duration
  photoRegion: PhotoRegion;
  templateRegion: PhotoRegion;
  photoFitMode: FitMode;
  templateFitMode: TemplateFitMode;
  effects: Y2KEffects;
  photoXOffset?: number;
  templateXOffset?: number;
}

export interface RenderJob {
  id: string;
  photoId: string;
  photoUrl: string;
  photoName: string;
  status: 'waiting' | 'rendering' | 'completed' | 'failed';
  progress: number;
  error?: string;
  outputPath?: string;
}

export interface ProjectState {
  id: string;
  name: string;
  templateConfig: TemplateConfig;
  photos: { id: string; url: string; name: string }[];
  jobs: RenderJob[];
  renderActive: boolean;
  filenamePrefix: string;
}
