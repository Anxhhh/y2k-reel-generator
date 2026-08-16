import { TemplateConfig, Y2KEffects, ProjectState } from './types';

export const DEFAULT_EFFECTS: Y2KEffects = {
  grain: { enabled: false, intensity: 0.15 },
  vhsNoise: { enabled: false, intensity: 0.2 },
  scanlines: { enabled: false, intensity: 0.15 },
  chromaticAberration: { enabled: false, offset: 5 },
  colorDegradation: { enabled: false, saturation: 0.7, contrast: 1.2, brightness: 0.95 },
  jitter: { enabled: false, intensity: 0.1 }
};

export const PRESET_TEMPLATES: Omit<TemplateConfig, 'id' | 'templateSource' | 'templateType'>[] = [
  {
    name: 'Y2K SPLIT 50/50',
    canvasWidth: 1080,
    canvasHeight: 1920,
    fps: 30,
    durationSeconds: 5,
    photoRegion: { x: 0.0, y: 0.0, width: 0.5, height: 1.0 },
    templateRegion: { x: 0.5, y: 0.0, width: 0.5, height: 1.0 },
    photoFitMode: 'STRETCH',
    templateFitMode: 'fill',
    effects: DEFAULT_EFFECTS
  },
  {
    name: 'Y2K SPLIT 40/60',
    canvasWidth: 1080,
    canvasHeight: 1920,
    fps: 30,
    durationSeconds: 5,
    photoRegion: { x: 0.0, y: 0.0, width: 0.4, height: 1.0 },
    templateRegion: { x: 0.4, y: 0.0, width: 0.6, height: 1.0 },
    photoFitMode: 'STRETCH',
    templateFitMode: 'fill',
    effects: DEFAULT_EFFECTS
  },
  {
    name: 'Y2K SPLIT 60/40',
    canvasWidth: 1080,
    canvasHeight: 1920,
    fps: 30,
    durationSeconds: 5,
    photoRegion: { x: 0.0, y: 0.0, width: 0.6, height: 1.0 },
    templateRegion: { x: 0.6, y: 0.0, width: 0.4, height: 1.0 },
    photoFitMode: 'STRETCH',
    templateFitMode: 'fill',
    effects: DEFAULT_EFFECTS
  },
  {
    name: 'Y2K VHS EDIT',
    canvasWidth: 1080,
    canvasHeight: 1920,
    fps: 30,
    durationSeconds: 5,
    photoRegion: { x: 0.05, y: 0.05, width: 0.45, height: 0.90 },
    templateRegion: { x: 0.5, y: 0.05, width: 0.45, height: 0.90 },
    photoFitMode: 'STRETCH',
    templateFitMode: 'fill',
    effects: {
      ...DEFAULT_EFFECTS,
      grain: { enabled: true, intensity: 0.25 },
      vhsNoise: { enabled: true, intensity: 0.3 },
      scanlines: { enabled: true, intensity: 0.15 },
      chromaticAberration: { enabled: true, offset: 6 },
      jitter: { enabled: true, intensity: 0.1 }
    }
  }
];

const PROJECTS_KEY = 'y2k_reel_maker_projects';

export const loadProjects = (): ProjectState[] => {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load projects from localStorage', e);
    return [];
  }
};

export const saveProjects = (projects: ProjectState[]) => {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage', e);
  }
};

export const createNewProject = (name: string, presetIndex: number): ProjectState => {
  const preset = PRESET_TEMPLATES[presetIndex] || PRESET_TEMPLATES[0];
  const id = `project_${Date.now()}`;
  return {
    id,
    name,
    templateConfig: {
      ...preset,
      id: `template_${Date.now()}`,
      templateSource: '',
      templateType: 'video'
    },
    photos: [],
    jobs: [],
    renderActive: false,
    filenamePrefix: 'ANXHH_Y2K'
  };
};
