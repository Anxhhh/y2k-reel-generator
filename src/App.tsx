import { useState, useEffect } from 'react';
import { ProjectState, TemplateConfig, FitMode, RenderJob } from './types';
import { TemplateEditor } from './components/TemplateEditor';
import { PhotoUploader } from './components/PhotoUploader';
import { DEFAULT_EFFECTS } from './store';

const INITIAL_PROJECT: ProjectState = {
  id: 'project_default',
  name: 'Visual2000 Workspace',
  templateConfig: {
    id: 'template_default',
    name: 'Y2K SPLIT 50/50',
    templateSource: '',
    templateType: 'video',
    canvasWidth: 1080,
    canvasHeight: 1920,
    fps: 30,
    durationSeconds: 15,
    photoRegion: { x: 0.0, y: 0.0, width: 0.5, height: 1.0 },
    templateRegion: { x: 0.5, y: 0.0, width: 0.5, height: 1.0 },
    photoFitMode: 'STRETCH',
    templateFitMode: 'fill',
    effects: DEFAULT_EFFECTS,
  },
  photos: [],
  jobs: [],
  renderActive: false,
  filenamePrefix: 'VISUAL2000',
};

export default function App() {
  const [currentProject, setCurrentProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<RenderJob | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'adjust' | 'media'>('adjust');
  const [downloadedJobIds, setDownloadedJobIds] = useState<string[]>([]);
  const [activeRegion, setActiveRegion] = useState<'photo' | 'template'>('photo');

  // Poll status of active rendering jobs
  useEffect(() => {
    if (!currentProject.renderActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${currentProject.id}/status`);
        if (!res.ok) throw new Error('Status poll failed');
        const { jobs } = await res.json();

        const finished = jobs.length > 0 && jobs.every((j: any) => j.status === 'completed' || j.status === 'failed');

        setCurrentProject((prev) => ({
          ...prev,
          jobs,
          renderActive: !finished,
        }));

        if (finished) {
          clearInterval(interval);
          alert('🎉 Rendering complete! All reels have been generated.');
        }
      } catch (err) {
        console.error('[Polling] Error fetching active render status:', err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [currentProject.renderActive, currentProject.id]);

  // Fetch initial project status on mount
  useEffect(() => {
    const fetchInitialStatus = async () => {
      try {
        const res = await fetch(`/api/projects/${currentProject.id}/status`);
        if (!res.ok) throw new Error('Initial status fetch failed');
        const { jobs } = await res.json();
        const finished = jobs.length > 0 && jobs.every((j: any) => j.status === 'completed' || j.status === 'failed');
        setCurrentProject((prev) => ({
          ...prev,
          jobs,
          renderActive: !finished && jobs.length > 0,
        }));
      } catch (err) {
        console.error('[Initial Fetch] Error fetching initial project status:', err);
      }
    };

    fetchInitialStatus();
  }, [currentProject.id]);

  // Auto-download completed MP4 files directly to the browser
  useEffect(() => {
    const completedJobs = currentProject.jobs.filter((j) => j.status === 'completed');
    if (completedJobs.length === 0) return;

    completedJobs.forEach((job) => {
      if (!downloadedJobIds.includes(job.id) && job.outputPath) {
        // Trigger browser download!
        const link = document.createElement('a');
        link.href = job.outputPath;
        link.setAttribute('download', `${job.photoName.split('.')[0]}_reel.mp4`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Record that it is downloaded
        setDownloadedJobIds((prev) => [...prev, job.id]);
      }
    });
  }, [currentProject.jobs, downloadedJobIds]);

  const handleConfigChange = (newConfig: TemplateConfig) => {
    setCurrentProject((prev) => ({
      ...prev,
      templateConfig: newConfig,
    }));
  };

  // Upload visual template file
  const handleUploadTemplate = async (file: File) => {
    const formData = new FormData();
    formData.append('template', file);

    try {
      const res = await fetch('/api/upload-template', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload template');
      }

      const data = await res.json();
      
      // Determine template type (video or static image)
      const isVideo = /\.(mp4|mov|webm)$/i.test(data.filename);
      const templateType: 'video' | 'image' = isVideo ? 'video' : 'image';

      // Update state immediately
      setCurrentProject((prev) => ({
        ...prev,
        templateConfig: {
          ...prev.templateConfig,
          templateSource: data.fileUrl,
          templateType,
        },
      }));

      // Call metadata detection to set correct fps/duration from video files
      handleDetectMetadata(data.filename);

    } catch (err: any) {
      alert('Template upload failed: ' + err.message);
    }
  };

  // Detect metadata for template videos
  const handleDetectMetadata = async (filename: string) => {
    try {
      const res = await fetch(`/api/detect-metadata?filename=${filename}`);
      if (!res.ok) throw new Error('Metadata fetch failed');
      const data = await res.json();

      setCurrentProject((prev) => ({
        ...prev,
        templateConfig: {
          ...prev.templateConfig,
          durationSeconds: data.durationSeconds || prev.templateConfig.durationSeconds,
          fps: data.fps || prev.templateConfig.fps,
        },
      }));
    } catch (err) {
      console.error('[Metadata] Error pre-populating composition parameters:', err);
    }
  };

  // Upload batch of photos
  const handleUploadPhotos = async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    try {
      const res = await fetch('/api/upload-photos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload photos');
      }

      const data = await res.json();
      const updatedPhotos = [...currentProject.photos, ...data.photos];
      
      setCurrentProject((prev) => ({
        ...prev,
        photos: updatedPhotos,
      }));

      // Auto-select first uploaded photo if nothing selected yet
      if (!selectedPhotoId && updatedPhotos.length > 0) {
        setSelectedPhotoId(updatedPhotos[0].id);
      }

    } catch (err: any) {
      alert('Batch photo upload failed: ' + err.message);
    }
  };

  // Remove photo from project
  const handleRemovePhoto = (id: string) => {
    const updatedPhotos = currentProject.photos.filter((p) => p.id !== id);
    
    setCurrentProject((prev) => ({
      ...prev,
      photos: updatedPhotos,
      jobs: prev.jobs.filter((j) => j.photoId !== id),
    }));

    if (selectedPhotoId === id) {
      setSelectedPhotoId(updatedPhotos.length > 0 ? updatedPhotos[0].id : null);
    }
  };

  // Select fitting mode
  const handleSelectFitMode = (mode: FitMode) => {
    handleConfigChange({
      ...currentProject.templateConfig,
      photoFitMode: mode,
    });
  };

  // Start rendering process
  const handleStartRender = async () => {
    if (!currentProject.templateConfig.templateSource) {
      alert('Validation failed: Please upload a composition template first.');
      return;
    }
    if (currentProject.photos.length === 0) {
      alert('Validation failed: Please upload at least one photo.');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${currentProject.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateConfig: currentProject.templateConfig,
          photos: currentProject.photos,
          filenamePrefix: currentProject.filenamePrefix,
        }),
      });

      if (!res.ok) throw new Error('API rendering initialization failed');
      const data = await res.json();

      // Reset downloaded job cache on new export start
      setDownloadedJobIds([]);
      setCurrentProject((prev) => ({
        ...prev,
        jobs: data.jobs,
        renderActive: true,
      }));

    } catch (err: any) {
      alert('Failed to initiate rendering pipeline: ' + err.message);
    }
  };

  // Retry failed render job
  const handleRetryJob = async (job: RenderJob, index: number) => {
    const photo = currentProject.photos.find((p) => p.id === job.photoId);
    if (!photo) return;

    try {
      const res = await fetch(`/api/projects/${currentProject.id}/jobs/${job.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateConfig: currentProject.templateConfig,
          photo,
          filenamePrefix: currentProject.filenamePrefix,
          index,
        }),
      });

      if (!res.ok) throw new Error('Job retry API call failed');
      
      setCurrentProject((prev) => ({
        ...prev,
        renderActive: true,
        jobs: prev.jobs.map((j) => (j.id === job.id ? { ...j, status: 'waiting' as const, progress: 0, error: undefined } : j)),
      }));

    } catch (err: any) {
      alert('Failed to retry job: ' + err.message);
    }
  };



  const currentPhoto = currentProject.photos.find((p) => p.id === selectedPhotoId);
  const livePreviewPhotoUrl = currentPhoto ? currentPhoto.url : '';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title">
          📼 Visual<span>2000</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="mono" style={{ fontSize: '11px', color: '#ffffff' }}>
            LinkedIn: <a href="https://www.linkedin.com/in/anshmatlotia/" target="_blank" rel="noopener noreferrer" style={{ color: '#ffff00', textDecoration: 'underline', fontWeight: 'bold' }}>anshmatlotia</a>
          </div>
          <div className="mono mobile-hide" style={{ fontSize: '11px', color: '#ffffff', opacity: 0.6 }}>
            CCD EDITOR & COMPOSITOR v1.0
          </div>
        </div>
      </header>

      <div className="workspace-container">
        <div className={`workspace-panels mobile-tab-${activeMobileTab}`}>
          
          {/* Left Panel (Asset Uploader & Photo Grid) */}
          <TemplateEditor
            config={currentProject.templateConfig}
            photoUrl={livePreviewPhotoUrl}
            onChangeConfig={handleConfigChange}
            photos={currentProject.photos}
            selectedPhotoId={selectedPhotoId}
            jobs={currentProject.jobs}
            onSelectPhoto={setSelectedPhotoId}
            onRemovePhoto={handleRemovePhoto}
            onUploadTemplate={handleUploadTemplate}
            onUploadPhotos={handleUploadPhotos}
            onPreviewVideo={setPreviewJob}
            onRetryJob={handleRetryJob}
            activeRegion={activeRegion}
            onChangeActiveRegion={setActiveRegion}
          />

          {/* Right Panel (Layout parameters & Effects Tuning) */}
          <PhotoUploader
            config={currentProject.templateConfig}
            onChangeConfig={handleConfigChange}
            photos={currentProject.photos}
            jobs={currentProject.jobs}
            renderActive={currentProject.renderActive}
            filenamePrefix={currentProject.filenamePrefix}
            onChangePrefix={(prefix) => {
              setCurrentProject((prev) => ({
                ...prev,
                filenamePrefix: prefix,
              }));
            }}
            onStartRender={handleStartRender}
            onSelectFitMode={handleSelectFitMode}
            activeRegion={activeRegion}
          />
        </div>

        {/* Mobile Footer Tab Selector */}
        <div className="mobile-footer-nav">
          <button
            type="button"
            className={`btn ${activeMobileTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('media')}
            style={{ flex: 1, height: '36px' }}
          >
            📸 MEDIA & UPLOADS
          </button>
          <button
            type="button"
            className={`btn ${activeMobileTab === 'adjust' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('adjust')}
            style={{ flex: 1, height: '36px' }}
          >
            🎛️ EFFECTS & SETTINGS
          </button>
        </div>
      </div>

      {/* Video preview overlay modal */}
      {previewJob && (
        <div className="preview-modal" onClick={() => setPreviewJob(null)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-canvas">
              <video
                src={previewJob.outputPath}
                controls
                autoPlay
                loop
                style={{ height: '100%', aspectRatio: '9/16', backgroundColor: '#000', outline: 'none' }}
              />
            </div>
            <div className="preview-modal-sidebar">
              <button type="button" className="preview-modal-close" onClick={() => setPreviewJob(null)}>
                ✕ Close Preview
              </button>
              
              <h3 style={{ fontSize: '13px', marginBottom: '8px' }}>Visual2000 Output</h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                Asset: <strong style={{ color: '#000' }}>{previewJob.photoName}</strong>
              </p>

              <div style={{ padding: '8px', backgroundColor: '#fff', border: '1.5px inset var(--retro-shadow)', fontSize: '10px', lineHeight: '1.6' }} className="mono">
                <div style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>✓ COMPLETED</div>
                <div>Format: H.264 MP4</div>
                <div>Audio: NONE</div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <a
                  href={previewJob.outputPath}
                  download={previewJob.photoName.split('.')[0] + '_reel.mp4'}
                  className="btn btn-cyan"
                  style={{ width: '100%', padding: '8px' }}
                >
                  Download File
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
