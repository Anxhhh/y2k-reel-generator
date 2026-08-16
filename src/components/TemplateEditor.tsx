import React, { useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { Y2KReelComposition } from '../compositions/Y2KReelComposition';
import { TemplateConfig, RenderJob } from '../types';

interface TemplateEditorProps {
  config: TemplateConfig;
  photoUrl: string;
  onChangeConfig: (newConfig: TemplateConfig) => void;
  photos: { id: string; url: string; name: string }[];
  selectedPhotoId: string | null;
  jobs: RenderJob[];
  onSelectPhoto: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onUploadTemplate: (file: File) => void;
  onUploadPhotos: (files: FileList) => void;
  onPreviewVideo: (job: RenderJob) => void;
  onRetryJob: (job: RenderJob, index: number) => void;
  activeRegion: 'photo' | 'template';
  onChangeActiveRegion: (region: 'photo' | 'template') => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  config,
  photoUrl,
  onChangeConfig,
  photos,
  selectedPhotoId,
  jobs,
  onSelectPhoto,
  onRemovePhoto,
  onUploadTemplate,
  onUploadPhotos,
  onPreviewVideo,
  onRetryJob,
  activeRegion,
  onChangeActiveRegion,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef | null>(null);
  const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isDragOverTemplate, setIsDragOverTemplate] = useState(false);
  const [isDragOverPhotos, setIsDragOverPhotos] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Callback ref to guarantee subscription when player mounts
  const setPlayerRef = (node: PlayerRef | null) => {
    playerRef.current = node;
    setPlayerInstance(node);
  };

  // Sync timeline slider with play frame ticks using timeupdate
  React.useEffect(() => {
    if (!playerInstance) return;

    const handleTimeUpdate = () => {
      const frame = playerInstance.getCurrentFrame();
      if (typeof frame === 'number') {
        setCurrentFrame(Math.round(frame));
      }
    };

    playerInstance.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      playerInstance.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [playerInstance, config.templateSource]);

  // Drag-and-drop helpers for template
  const handleTemplateDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverTemplate(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadTemplate(e.dataTransfer.files[0]);
    }
  };

  // Drag-and-drop helpers for photos
  const handlePhotosDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPhotos(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadPhotos(e.dataTransfer.files);
    }
  };

  // Handle bounding box dragging/resizing for active region
  const handleMouseDown = (
    e: React.MouseEvent,
    type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;

    const startRegion = activeRegion === 'photo' ? config.photoRegion : config.templateRegion;
    const startXRatio = startRegion.x;
    const startYRatio = startRegion.y;
    const startWRatio = startRegion.width;
    const startHRatio = startRegion.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaXRatio = (moveEvent.clientX - startX) / rect.width;
      const deltaYRatio = (moveEvent.clientY - startY) / rect.height;

      let newX = startXRatio;
      let newY = startYRatio;
      let newW = startWRatio;
      let newH = startHRatio;

      if (type === 'move') {
        newX = Math.max(0, Math.min(1 - startWRatio, startXRatio + deltaXRatio));
        newY = Math.max(0, Math.min(1 - startHRatio, startYRatio + deltaYRatio));
      } else {
        if (type.includes('w')) {
          const potentialW = startWRatio - deltaXRatio;
          if (potentialW > 0.05) {
            newX = Math.max(0, startXRatio + deltaXRatio);
            newW = potentialW;
          }
        }
        if (type.includes('e')) {
          newW = Math.max(0.05, startWRatio + deltaXRatio);
        }
        if (type.includes('n')) {
          const potentialH = startHRatio - deltaYRatio;
          if (potentialH > 0.05) {
            newY = Math.max(0, startYRatio + deltaYRatio);
            newH = potentialH;
          }
        }
        if (type.includes('s')) {
          newH = Math.max(0.05, startHRatio + deltaYRatio);
        }

        newX = Math.max(0, Math.min(1, newX));
        newY = Math.max(0, Math.min(1, newY));
        newW = Math.min(1 - newX, newW);
        newH = Math.min(1 - newY, newH);
      }

      // Automatically adjust templateRegion if split logic applies and editing photo
      let updatedTemplateRegion = { ...config.templateRegion };
      if (activeRegion === 'photo' && newX === 0 && newY === 0 && newH === 1) {
        updatedTemplateRegion = {
          x: newW,
          y: 0,
          width: 1 - newW,
          height: 1,
        };
      }

      onChangeConfig({
        ...config,
        [activeRegion === 'photo' ? 'photoRegion' : 'templateRegion']: {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        },
        // Only override templateRegion if editing photo region on layout split
        ...(activeRegion === 'photo' && newX === 0 && newY === 0 && newH === 1 ? { templateRegion: updatedTemplateRegion } : {}),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getJobForPhoto = (photoId: string) => {
    return jobs.find((j) => j.photoId === photoId);
  };

  const fps = config.fps || 30;
  const durationSeconds = config.durationSeconds || 15;
  const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
  const activeBoxRegion = activeRegion === 'photo' ? config.photoRegion : config.templateRegion;

  return (
    <div className="editor-layout-wrapper">
      {/* Sidebar Controls (Left Panel - Uploader Panel) */}
      <div className="workspace-sidebar workspace-sidebar-left" style={{ width: '340px' }}>
        
        {/* 1. Upload Template Asset */}
        <div className="panel-section">
          <div className="panel-section-title">
            <span>01. Template Asset</span>
            <span className="mono">template</span>
          </div>


          <input
            type="file"
            ref={templateInputRef}
            style={{ display: 'none' }}
            accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
            onChange={(e) => e.target.files && e.target.files[0] && onUploadTemplate(e.target.files[0])}
          />

          <div
            className="upload-zone"
            style={{
              borderColor: isDragOverTemplate ? '#000080' : 'var(--retro-shadow)',
              background: isDragOverTemplate ? '#e4e0d8' : '#ffffff',
              padding: '12px',
              marginBottom: '6px',
            }}
            onClick={() => templateInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverTemplate(true);
            }}
            onDragLeave={() => setIsDragOverTemplate(false)}
            onDrop={handleTemplateDrop}
          >
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>📼</div>
            <p style={{ fontSize: '11px', margin: 0 }}>
              {config.templateSource ? 'REPLACE TEMPLATE' : 'UPLOAD TEMPLATE VIDEO/IMAGE'}
            </p>
          </div>

          {config.templateSource && (
            <div
              style={{
                padding: '4px 6px',
                backgroundColor: '#ffffff',
                border: '1.5px solid var(--retro-shadow)',
                fontSize: '9px',
                lineHeight: '1.3',
              }}
              className="mono"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', overflow: 'hidden' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>File:</span>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                  {config.templateSource.substring(config.templateSource.lastIndexOf('/') + 1)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Upload Batch Photos */}
        <div className="panel-section" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: 'none' }}>
          <div className="panel-section-title">
            <span>02. Photos Batch Upload</span>
            <span className="mono" style={{ color: '#00ff00' }}>{photos.length} files</span>
          </div>

          <input
            type="file"
            ref={photoInputRef}
            multiple
            style={{ display: 'none' }}
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => e.target.files && onUploadPhotos(e.target.files)}
          />

          <div
            className="upload-zone"
            style={{
              borderColor: isDragOverPhotos ? '#000080' : 'var(--retro-shadow)',
              background: isDragOverPhotos ? '#e4e0d8' : '#ffffff',
              padding: '12px',
              marginBottom: '8px',
              flexShrink: 0,
            }}
            onClick={() => photoInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverPhotos(true);
            }}
            onDragLeave={() => setIsDragOverPhotos(false)}
            onDrop={handlePhotosDrop}
          >
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>📸</div>
            <p style={{ fontSize: '11px', margin: 0 }}>DRAG & DROP PHOTOS</p>
          </div>

          {photos.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 10px', textAlign: 'center' }}>
              <p style={{ margin: 0 }}>No photos added yet.</p>
            </div>
          ) : (
            <div style={{ flexGrow: 1, overflowY: 'auto', border: '2px inset #808080', background: '#fff', padding: '6px' }}>
              <div className="photos-grid">
                {photos.map((photo, index) => {
                  const job = getJobForPhoto(photo.id);
                  const isSelected = selectedPhotoId === photo.id;

                  return (
                    <div
                      key={photo.id}
                      className={`photo-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectPhoto(photo.id)}
                      style={{ border: isSelected ? '2px solid #000080' : '1px solid var(--retro-shadow)' }}
                    >
                      <img src={photo.url} alt={photo.name} />

                      <div className="photo-card-actions">
                        {job && job.status === 'completed' && (
                          <>
                            <button
                              type="button"
                              className="photo-card-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreviewVideo(job);
                              }}
                            >
                              ▶
                            </button>
                            <a
                              href={job.outputPath}
                              download={`${photo.name.split('.')[0]}_reel.mp4`}
                              className="photo-card-btn"
                              style={{ background: 'var(--accent-green)', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📥
                            </a>
                          </>
                        )}
                        {job && job.status === 'failed' && (
                          <button
                            type="button"
                            className="photo-card-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryJob(job, index);
                            }}
                          >
                            ↺
                          </button>
                        )}
                        <button
                          type="button"
                          className="photo-card-btn"
                          style={{ background: 'var(--accent-red)', color: '#fff' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemovePhoto(photo.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>

                      <div className="photo-card-name" style={{ fontSize: '7px' }}>{photo.name}</div>

                      {job && (
                        <span 
                          className={`photo-card-status ${job.status}`} 
                          style={{ fontSize: '7px', padding: '1px' }}
                          title={job.error}
                        >
                          {job.status === 'rendering' ? `${job.progress}%` : job.status === 'completed' ? 'DONE' : 'FAIL'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Main Preview Workspace (Center Column - Player) */}
      <div className="workspace-main">
        <div className="canvas-wrapper" ref={canvasRef}>
          {config.templateSource ? (
            <Player
              component={Y2KReelComposition as any}
              inputProps={{
                photoUrl,
                templateSource: config.templateSource,
                templateType: config.templateType,
                photoRegion: config.photoRegion,
                templateRegion: config.templateRegion,
                photoFitMode: config.photoFitMode,
                templateFitMode: config.templateFitMode,
                effects: config.effects,
                photoXOffset: config.photoXOffset ?? 0,
                templateXOffset: config.templateXOffset ?? 0,
              }}
              durationInFrames={durationFrames}
              fps={config.fps}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: '100%', height: '100%' }}
              ref={setPlayerRef}
              controls={false}
              loop
            />
          ) : (
            <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="empty-state-icon">📼</div>
              <h3>No Template Loaded</h3>
              <p>Upload a template video or static overlay on the left sidebar to start.</p>
            </div>
          )}

          {/* Transparent selection overlays on the canvas layout */}
          {config.templateSource && (
            <>
              {/* Photo Region Click Hot-zone */}
              <div
                style={{
                  position: 'absolute',
                  left: `${config.photoRegion.x * 100}%`,
                  top: `${config.photoRegion.y * 100}%`,
                  width: `${config.photoRegion.width * 100}%`,
                  height: `${config.photoRegion.height * 100}%`,
                  zIndex: 20,
                  cursor: 'pointer',
                }}
                onClick={() => onChangeActiveRegion('photo')}
              />
              
              {/* Template Region Click Hot-zone */}
              <div
                style={{
                  position: 'absolute',
                  left: `${config.templateRegion.x * 100}%`,
                  top: `${config.templateRegion.y * 100}%`,
                  width: `${config.templateRegion.width * 100}%`,
                  height: `${config.templateRegion.height * 100}%`,
                  zIndex: 20,
                  cursor: 'pointer',
                }}
                onClick={() => onChangeActiveRegion('template')}
              />

              {/* Bounding Box Selector around active region */}
              <div
                className="photo-region-selector"
                style={{
                  left: `${activeBoxRegion.x * 100}%`,
                  top: `${activeBoxRegion.y * 100}%`,
                  width: `${activeBoxRegion.width * 100}%`,
                  height: `${activeBoxRegion.height * 100}%`,
                  zIndex: 25,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                <div className="region-label" style={{ background: activeRegion === 'photo' ? '#ffff00' : '#00ffff', color: '#000' }}>
                  ACTIVE EDIT: {activeRegion.toUpperCase()} ({activeRegion === 'photo' ? config.photoFitMode : config.templateFitMode.toUpperCase()})
                </div>
                <div className="resize-handle resize-handle-nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
                <div className="resize-handle resize-handle-ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                <div className="resize-handle resize-handle-se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
                <div className="resize-handle resize-handle-sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                <div className="resize-handle resize-handle-n" onMouseDown={(e) => handleMouseDown(e, 'n')} />
                <div className="resize-handle resize-handle-s" onMouseDown={(e) => handleMouseDown(e, 's')} />
                <div className="resize-handle resize-handle-e" onMouseDown={(e) => handleMouseDown(e, 'e')} />
                <div className="resize-handle resize-handle-w" onMouseDown={(e) => handleMouseDown(e, 'w')} />
              </div>
            </>
          )}
        </div>

        {/* Retro VCR Player Control Panel */}
        {config.templateSource && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '290px',
              marginTop: '12px',
              gap: '8px',
            }}
          >
            {/* Timeline Scrub Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span className="mono" style={{ fontSize: '9px', width: '32px', textAlign: 'right' }}>
                {Math.round(currentFrame / config.fps)}s
              </span>
              <input
                type="range"
                min="0"
                max={durationFrames - 1}
                value={currentFrame}
                className="slider-input"
                style={{ flex: 1, height: '14px', margin: 0 }}
                onChange={(e) => playerInstance?.seekTo(Number(e.target.value))}
              />
              <span className="mono" style={{ fontSize: '9px', width: '32px', textAlign: 'left' }}>
                {Math.round(durationFrames / config.fps)}s
              </span>
            </div>

            {/* Play & Pause Action buttons */}
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <button
                type="button"
                className="btn mono"
                style={{ flex: 1, padding: '6px 12px' }}
                onClick={() => playerInstance?.play()}
              >
                ▶ PLAY
              </button>
              <button
                type="button"
                className="btn mono"
                style={{ flex: 1, padding: '6px 12px' }}
                onClick={() => playerInstance?.pause()}
              >
                ⏸ PAUSE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
