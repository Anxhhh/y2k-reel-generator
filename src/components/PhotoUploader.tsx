import React, { useState } from 'react';
import { FitMode, TemplateConfig, TemplateFitMode, Y2KEffects } from '../types';

interface PhotoUploaderProps {
  config: TemplateConfig;
  onChangeConfig: (newConfig: TemplateConfig) => void;
  photos: { id: string; url: string; name: string }[];
  jobs: any[];
  renderActive: boolean;
  filenamePrefix: string;
  onChangePrefix: (prefix: string) => void;
  onStartRender: () => void;
  onSelectFitMode: (mode: FitMode) => void;
  activeRegion: 'photo' | 'template';
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  config,
  onChangeConfig,
  photos,
  jobs,
  renderActive,
  filenamePrefix,
  onChangePrefix,
  onStartRender,
  onSelectFitMode,
  activeRegion,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'dimensions'>('preset');

  // Handle coordinates changes for the active region
  const handleInputChange = (field: 'x' | 'y' | 'width' | 'height', value: number) => {
    const clamped = Math.max(0, Math.min(1, value / 100));
    const targetRegion = activeRegion === 'photo' ? config.photoRegion : config.templateRegion;
    const updated = { ...targetRegion, [field]: clamped };

    onChangeConfig({
      ...config,
      [activeRegion === 'photo' ? 'photoRegion' : 'templateRegion']: updated,
    });
  };

  const applyPreset = (ratio: number, padding: number = 0) => {
    const photoRegion = {
      x: padding,
      y: padding,
      width: ratio - padding * 2,
      height: 1 - padding * 2,
    };
    const templateRegion = {
      x: ratio,
      y: padding,
      width: 1 - ratio - padding,
      height: 1 - padding * 2,
    };

    onChangeConfig({
      ...config,
      photoRegion,
      templateRegion,
    });
  };

  const handleToggleEffect = (key: keyof Y2KEffects) => {
    onChangeConfig({
      ...config,
      effects: {
        ...config.effects,
        [key]: {
          ...config.effects[key],
          enabled: !config.effects[key].enabled,
        },
      },
    });
  };

  const handleSliderEffectChange = (
    effectKey: keyof Y2KEffects,
    sliderKey: string,
    value: number
  ) => {
    onChangeConfig({
      ...config,
      effects: {
        ...config.effects,
        [effectKey]: {
          ...config.effects[effectKey],
          [sliderKey]: value,
        },
      },
    });
  };

  const effects = config.effects;
  const totalCount = jobs.length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Active region values definition
  const activeRegionData = activeRegion === 'photo' ? config.photoRegion : config.templateRegion;

  return (
    <div className="workspace-sidebar workspace-sidebar-right" style={{ width: '380px', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. Fitting Modes & Panning Positions */}
      <div className="panel-section">
        <div className="panel-section-title">
          <span>01. Fitting & Frame Adjustment</span>
          <span className="mono">fit</span>
        </div>

        <div className="form-group" style={{ marginBottom: '8px' }}>
          <label>Photo Fit Mode</label>
          <div className="fit-modes-select">
            {(['STRETCH', 'CROP', 'CONTAIN'] as FitMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`fit-mode-btn ${config.photoFitMode === mode ? 'active' : ''}`}
                onClick={() => onSelectFitMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label>Template Fit Mode</label>
          <div className="fit-modes-select">
            {(['fill', 'fit', 'stretch'] as TemplateFitMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`fit-mode-btn ${config.templateFitMode === mode ? 'active' : ''}`}
                onClick={() => onChangeConfig({ ...config, templateFitMode: mode })}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Position Adjust Offset Sliders (horizontal pans inside frame) */}
        <div className="slider-group" style={{ marginBottom: '8px' }}>
          <div className="slider-header" style={{ fontSize: '9px' }}>
            <span>Photo Frame Horizontal Offset</span>
            <span className="mono">{config.photoXOffset ?? 0}%</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            className="slider-input"
            value={config.photoXOffset ?? 0}
            onChange={(e) => onChangeConfig({ ...config, photoXOffset: Number(e.target.value) })}
          />
        </div>

        <div className="slider-group">
          <div className="slider-header" style={{ fontSize: '9px' }}>
            <span>Template Frame Horizontal Offset</span>
            <span className="mono">{config.templateXOffset ?? 0}%</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            className="slider-input"
            value={config.templateXOffset ?? 0}
            onChange={(e) => onChangeConfig({ ...config, templateXOffset: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* 2. Layout Splitting & Presets */}
      <div className="panel-section">
        <div className="panel-section-title">
          <span>02. Layout Splitting</span>
          <span className="mono">split</span>
        </div>


        <div style={{ display: 'flex', borderBottom: '1px solid var(--retro-shadow)', marginBottom: '12px' }}>
          <button
            className="mono"
            style={{
              flex: 1,
              padding: '6px',
              background: activeTab === 'preset' ? '#dfdfdf' : 'none',
              border: '1px solid var(--retro-shadow)',
              borderBottom: 'none',
              color: '#000',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
            onClick={() => setActiveTab('preset')}
          >
            PRESETS
          </button>
          <button
            className="mono"
            style={{
              flex: 1,
              padding: '6px',
              background: activeTab === 'dimensions' ? '#dfdfdf' : 'none',
              border: '1px solid var(--retro-shadow)',
              borderBottom: 'none',
              color: '#000',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
            onClick={() => setActiveTab('dimensions')}
          >
            COORDINATES
          </button>
        </div>

        {activeTab === 'preset' ? (
          <div className="presets-grid">
            <button
              type="button"
              className={`preset-btn ${config.photoRegion.width === 0.5 && config.photoRegion.x === 0 ? 'active' : ''}`}
              onClick={() => applyPreset(0.5)}
            >
              50/50 Split
            </button>
            <button
              type="button"
              className={`preset-btn ${config.photoRegion.width === 0.4 && config.photoRegion.x === 0 ? 'active' : ''}`}
              onClick={() => applyPreset(0.4)}
            >
              40/60 Split
            </button>
            <button
              type="button"
              className={`preset-btn ${config.photoRegion.width === 0.6 && config.photoRegion.x === 0 ? 'active' : ''}`}
              onClick={() => applyPreset(0.6)}
            >
              60/40 Split
            </button>
            <button
              type="button"
              className={`preset-btn ${config.photoRegion.width === 0.45 && config.photoRegion.x === 0.05 ? 'active' : ''}`}
              onClick={() => applyPreset(0.45, 0.05)}
            >
              VHS Frame
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{activeRegion.toUpperCase()} X (%)</label>
                <input
                  type="number"
                  className="form-input mono"
                  value={Math.round(activeRegionData.x * 100)}
                  onChange={(e) => handleInputChange('x', Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{activeRegion.toUpperCase()} Y (%)</label>
                <input
                  type="number"
                  className="form-input mono"
                  value={Math.round(activeRegionData.y * 100)}
                  onChange={(e) => handleInputChange('y', Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{activeRegion.toUpperCase()} W (%)</label>
                <input
                  type="number"
                  className="form-input mono"
                  value={Math.round(activeRegionData.width * 100)}
                  onChange={(e) => handleInputChange('width', Number(e.target.value))}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{activeRegion.toUpperCase()} H (%)</label>
                <input
                  type="number"
                  className="form-input mono"
                  value={Math.round(activeRegionData.height * 100)}
                  onChange={(e) => handleInputChange('height', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Output Parameters */}
      <div className="panel-section">
        <div className="panel-section-title">
          <span>03. Video Settings</span>
          <span className="mono">config</span>
        </div>

        <div className="form-group" style={{ marginBottom: '8px' }}>
          <label>Output Duration (Seconds)</label>
          <input
            type="number"
            min="1"
            max="60"
            className="form-input mono"
            value={config.durationSeconds}
            onChange={(e) => onChangeConfig({ ...config, durationSeconds: Number(e.target.value) })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Output FPS</label>
            <select
              className="form-select mono"
              value={config.fps}
              onChange={(e) => onChangeConfig({ ...config, fps: Number(e.target.value) })}
            >
              <option value="24">24 FPS</option>
              <option value="30">30 FPS</option>
              <option value="60">60 FPS</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Resolution</label>
            <select
              className="form-select mono"
              value={`${config.canvasWidth}x${config.canvasHeight}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                onChangeConfig({
                  ...config,
                  canvasWidth: w,
                  canvasHeight: h,
                });
              }}
            >
              <option value="720x1280">720p (9:16)</option>
              <option value="1080x1920">1080p (9:16)</option>
              <option value="2160x3840">4K (9:16)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Analog Noise Filters */}
      <div className="panel-section">
        <div className="panel-section-title">
          <span>04. Analog Noise Filters</span>
          <span className="mono">noise</span>
        </div>

        {/* Film Grain */}
        <div style={{ marginBottom: '8px' }}>
          <div className="toggle-group" style={{ marginBottom: '4px' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={effects.grain.enabled}
                onChange={() => handleToggleEffect('grain')}
              />
              <span className="toggle-slider" />
            </label>
            <span className="toggle-label">Film Grain Texture</span>
          </div>
          {effects.grain.enabled && (
            <div className="slider-group">
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                className="slider-input"
                value={effects.grain.intensity}
                onChange={(e) => handleSliderEffectChange('grain', 'intensity', Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {/* VHS Static */}
        <div style={{ marginBottom: '8px' }}>
          <div className="toggle-group" style={{ marginBottom: '4px' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={effects.vhsNoise.enabled}
                onChange={() => handleToggleEffect('vhsNoise')}
              />
              <span className="toggle-slider" />
            </label>
            <span className="toggle-label">VHS Static Line</span>
          </div>
          {effects.vhsNoise.enabled && (
            <div className="slider-group">
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                className="slider-input"
                value={effects.vhsNoise.intensity}
                onChange={(e) => handleSliderEffectChange('vhsNoise', 'intensity', Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {/* CRT Scanlines */}
        <div>
          <div className="toggle-group" style={{ marginBottom: '4px' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={effects.scanlines.enabled}
                onChange={() => handleToggleEffect('scanlines')}
              />
              <span className="toggle-slider" />
            </label>
            <span className="toggle-label">CRT Scanlines Overlay</span>
          </div>
          {effects.scanlines.enabled && (
            <div className="slider-group">
              <input
                type="range"
                min="0.05"
                max="0.6"
                step="0.05"
                className="slider-input"
                value={effects.scanlines.intensity}
                onChange={(e) => handleSliderEffectChange('scanlines', 'intensity', Number(e.target.value))}
              />
            </div>
          )}
        </div>
      </div>

      {/* 5. Lens & Tape Distortion */}
      <div className="panel-section">
        <div className="panel-section-title">
          <span>05. Lens & Tape Distortion</span>
          <span className="mono">distortion</span>
        </div>

        {/* Chromatic Aberration */}
        <div style={{ marginBottom: '8px' }}>
          <div className="toggle-group" style={{ marginBottom: '4px' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={effects.chromaticAberration.enabled}
                onChange={() => handleToggleEffect('chromaticAberration')}
              />
              <span className="toggle-slider" />
            </label>
            <span className="toggle-label">Chromatic Aberration</span>
          </div>
          {effects.chromaticAberration.enabled && (
            <div className="slider-group">
              <input
                type="range"
                min="2"
                max="25"
                step="1"
                className="slider-input"
                value={effects.chromaticAberration.offset}
                onChange={(e) =>
                  handleSliderEffectChange('chromaticAberration', 'offset', Number(e.target.value))
                }
              />
            </div>
          )}
        </div>

        {/* Jitter */}
        <div>
          <div className="toggle-group" style={{ marginBottom: '4px' }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={effects.jitter.enabled}
                onChange={() => handleToggleEffect('jitter')}
              />
              <span className="toggle-slider" />
            </label>
            <span className="toggle-label">Horizontal Frame Jitter</span>
          </div>
          {effects.jitter.enabled && (
            <div className="slider-group">
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                className="slider-input"
                value={effects.jitter.intensity}
                onChange={(e) => handleSliderEffectChange('jitter', 'intensity', Number(e.target.value))}
              />
            </div>
          )}
        </div>
      </div>

      {/* 6. VHS Tone Color Grading */}
      <div className="panel-section">
        <div className="panel-section-title">
          <span>06. Color Grading</span>
          <span className="mono">color</span>
        </div>

        <div className="toggle-group" style={{ marginBottom: '4px' }}>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={effects.colorDegradation.enabled}
              onChange={() => handleToggleEffect('colorDegradation')}
            />
            <span className="toggle-slider" />
          </label>
          <span className="toggle-label">CCD Analog Tone Bleed</span>
        </div>
        {effects.colorDegradation.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            <div className="slider-group">
              <div className="slider-header" style={{ fontSize: '9px' }}>
                <span>Saturation</span>
                <span className="mono">{Math.round(effects.colorDegradation.saturation * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.8"
                step="0.1"
                className="slider-input"
                value={effects.colorDegradation.saturation}
                onChange={(e) =>
                  handleSliderEffectChange('colorDegradation', 'saturation', Number(e.target.value))
                }
              />
            </div>

            <div className="slider-group">
              <div className="slider-header" style={{ fontSize: '9px' }}>
                <span>Contrast</span>
                <span className="mono">{Math.round(effects.colorDegradation.contrast * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.8"
                step="0.05"
                className="slider-input"
                value={effects.colorDegradation.contrast}
                onChange={(e) =>
                  handleSliderEffectChange('colorDegradation', 'contrast', Number(e.target.value))
                }
              />
            </div>

            <div className="slider-group">
              <div className="slider-header" style={{ fontSize: '9px' }}>
                <span>Brightness</span>
                <span className="mono">{Math.round(effects.colorDegradation.brightness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                className="slider-input"
                value={effects.colorDegradation.brightness}
                onChange={(e) =>
                  handleSliderEffectChange('colorDegradation', 'brightness', Number(e.target.value))
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* 7. Export & Render Controls */}
      <div className="panel-section" style={{ borderBottom: 'none', backgroundColor: '#e4e0d8', borderTop: '2px solid var(--retro-shadow)', marginTop: 'auto', flexShrink: 0 }}>
        <div className="panel-section-title">
          <span>07. Export video</span>
          <span className="mono">output</span>
        </div>

        <div className="form-group" style={{ marginBottom: '8px' }}>
          <label>File Prefix</label>
          <input
            type="text"
            className="form-input mono"
            disabled={renderActive}
            value={filenamePrefix}
            onChange={(e) => onChangePrefix(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
          />
        </div>

        {totalCount > 0 && (
          <div className="render-progress-card" style={{ padding: '6px', marginBottom: '8px', border: '1px solid var(--retro-shadow)', boxShadow: 'none' }}>
            <div className="progress-header" style={{ fontSize: '9px', marginBottom: '2px' }}>
              <span>ENCODING STATUS ({completedCount}/{totalCount})</span>
              <span className="mono">{progressPercent}%</span>
            </div>
            <div className="progress-bar-container" style={{ height: '10px', marginBottom: 0 }}>
              <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-green"
            style={{ flexGrow: 1 }}
            disabled={photos.length === 0 || renderActive}
            onClick={onStartRender}
          >
            {renderActive ? 'EXPORTING MP4...' : 'EXPORT MP4'}
          </button>
        </div>
      </div>

    </div>
  );
};
