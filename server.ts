import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import os from 'os';
import { renderMedia, selectComposition, getVideoMetadata } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { RenderJob } from './src/types';

const app = express();
const PORT = 5001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Set up directory paths
const PUBLIC_DIR = path.resolve('./public');
const UPLOADS_DIR = path.resolve('./public/uploads');
const RENDERS_DIR = path.resolve('./public/renders');
const TEMP_DIR = path.resolve('./public/temp');

// Create directories if they do not exist
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(RENDERS_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Serve static directories
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/renders', express.static(RENDERS_DIR));
app.use(express.static(PUBLIC_DIR));

// Serve precompiled Remotion bundle statically if present
const REMOTION_BUILD_DIR = path.resolve('./build');
app.use('/remotion-bundle', express.static(REMOTION_BUILD_DIR));

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|mp4|mov|webm/i;
    const extname = filetypes.test(path.extname(file.originalname));
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload JPG, PNG, WEBP, MP4, MOV or WebM.'));
    }
  },
});

// Programmatic Remotion bundle caching
let bundleLoc: string | null = null;
const getBundle = async () => {
  const precompiledPath = path.resolve('./build');
  if (fs.existsSync(precompiledPath)) {
    return precompiledPath;
  }
  if (!bundleLoc) {
    console.log('[Remotion] Compiling composition bundle...');
    const entry = path.resolve('./src/compositions/index.tsx');
    bundleLoc = await bundle({
      entryPoint: entry,
    });
    console.log('[Remotion] Bundle successfully created at:', bundleLoc);
  }
  return bundleLoc;
};

// In-memory render job status tracking
const activeJobs: Record<string, RenderJob[]> = {};

interface QueueItem {
  jobId: string;
  projectId: string;
  photoUrl: string;
  photoPath: string;
  photoName: string;
  templateConfig: any;
  outputPath: string;
  outputFilename: string;
}

const renderQueue: QueueItem[] = [];
let activeRendersCount = 0;
const CONCURRENCY_LIMIT = 2;

// Utility to update active job statuses in memory
const updateJobStatus = (
  projectId: string,
  jobId: string,
  status: RenderJob['status'],
  progress: number,
  outputPath?: string,
  error?: string
) => {
  if (!activeJobs[projectId]) {
    activeJobs[projectId] = [];
  }
  const job = activeJobs[projectId].find((j) => j.id === jobId);
  if (job) {
    job.status = status;
    job.progress = progress;
    if (outputPath) job.outputPath = outputPath;
    if (error) job.error = error;
  }
};

// Queue processor
const processQueue = async () => {
  if (activeRendersCount >= CONCURRENCY_LIMIT || renderQueue.length === 0) {
    return;
  }

  const nextJob = renderQueue.shift();
  if (!nextJob) return;

  activeRendersCount++;
  const { jobId, projectId, photoUrl, photoPath, photoName, templateConfig, outputPath } = nextJob;

  updateJobStatus(projectId, jobId, 'rendering', 0);

  try {
    const bundlePath = await getBundle();
    const isDirectory = fs.statSync(bundlePath).isDirectory();
    const serveUrl = isDirectory 
      ? `http://127.0.0.1:${PORT}/remotion-bundle` 
      : bundlePath;

    const localPhotoUrl = photoUrl.startsWith('http')
      ? photoUrl
      : `http://127.0.0.1:${PORT}/uploads/${path.basename(photoUrl)}`;

    const localTemplateSource = templateConfig.templateSource.startsWith('http')
      ? templateConfig.templateSource
      : `http://127.0.0.1:${PORT}/uploads/${path.basename(templateConfig.templateSource)}`;

    const inputProps = {
      photoUrl: localPhotoUrl,
      templateSource: localTemplateSource,
      templateType: templateConfig.templateType,
      photoRegion: templateConfig.photoRegion,
      templateRegion: templateConfig.templateRegion,
      photoFitMode: templateConfig.photoFitMode,
      templateFitMode: templateConfig.templateFitMode,
      effects: templateConfig.effects,
      photoXOffset: templateConfig.photoXOffset || 0,
      templateXOffset: templateConfig.templateXOffset || 0,
    };

    const fps = templateConfig.fps || 30;
    const durationInFrames = Math.round((templateConfig.durationSeconds || 5) * fps);

    console.log(`[Renderer] Starting render job ${jobId} for photo: ${photoName}`);

    // Select the composition to compile
    const composition = await selectComposition({
      serveUrl,
      id: 'Y2KReel',
      inputProps,
    });

    // Override size & frames
    composition.durationInFrames = durationInFrames;
    composition.fps = fps;
    composition.width = 1080;
    composition.height = 1920;

    await renderMedia({
      composition,
      serveUrl,
      outputLocation: outputPath,
      codec: 'h264',
      // Explicitly disable audio so the H.264 file is completely silent without audio tracks
      audioCodec: undefined,
      muted: true,
      imageFormat: 'jpeg',
      jpegQuality: 80,
      concurrency: process.env.PORT ? 1 : Math.max(1, os.cpus().length),
      inputProps,
      onProgress: ({ progress }) => {
        const percent = Math.min(Math.round(progress * 100), 99);
        updateJobStatus(projectId, jobId, 'rendering', percent);
      },
    });

    console.log(`[Renderer] Render completed: ${path.basename(outputPath)}`);
    updateJobStatus(
      projectId,
      jobId,
      'completed',
      100,
      `/renders/${path.basename(outputPath)}`
    );
  } catch (err: any) {
    console.error(`[Renderer] Render failed for job ${jobId}:`, err);
    updateJobStatus(projectId, jobId, 'failed', 0, undefined, err.message || 'Render failed');
  } finally {
    activeRendersCount--;
    // Trigger processing of next item
    processQueue();
  }
};

// API Endpoint to upload template files
app.post('/api/upload-template', upload.single('template'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No template file provided' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    filePath: req.file.path,
    filename: req.file.filename,
    fileUrl,
  });
});

// API Endpoint to upload photos (handles multiple)
app.post('/api/upload-photos', upload.array('photos', 200), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No photo files provided' });
  }

  const uploaded = files.map((file) => ({
    id: `photo_${Date.now()}_${Math.round(Math.random() * 1e5)}`,
    name: file.originalname,
    url: `/uploads/${file.filename}`,
    path: file.path,
  }));

  res.json({ photos: uploaded });
});

// API Endpoint to detect video metadata
app.get('/api/detect-metadata', async (req, res) => {
  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'filename parameter is required' });
  }

  const filePath = path.join(UPLOADS_DIR, filename as string);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const isVideo = /\.(mp4|mov|webm)$/i.test(filename as string);
    if (isVideo) {
      console.log(`[Metadata] Reading metadata for video: ${filename}`);
      const meta = await getVideoMetadata(filePath);
      return res.json({
        type: 'video',
        durationSeconds: meta.durationInSeconds,
        fps: Math.round(meta.fps),
        width: meta.width,
        height: meta.height,
      });
    } else {
      return res.json({
        type: 'image',
        durationSeconds: 5,
        fps: 30,
        width: 1080,
        height: 1920,
      });
    }
  } catch (err: any) {
    console.error('[Metadata] Failed to read metadata:', err);
    res.status(500).json({ error: 'Failed to read video metadata: ' + err.message });
  }
});

// API Endpoint to start bulk render
app.post('/api/projects/:projectId/render', (req, res) => {
  const { projectId } = req.params;
  const { templateConfig, photos, filenamePrefix } = req.body;

  if (!templateConfig || !photos || photos.length === 0) {
    return res.status(400).json({ error: 'Missing template configuration or photo batch' });
  }

  // Clear previous rendering jobs for this project to start fresh
  activeJobs[projectId] = [];

  const createdJobs: RenderJob[] = [];

  photos.forEach((photo: any, index: number) => {
    const padIndex = String(index + 1).padStart(3, '0');
    const outputFilename = `${filenamePrefix || 'ANXHH_Y2K'}_${padIndex}.mp4`;
    const outputPath = path.join(RENDERS_DIR, outputFilename);
    const jobId = `job_${projectId}_${photo.id}`;

    const job: RenderJob = {
      id: jobId,
      photoId: photo.id,
      photoUrl: photo.url,
      photoName: photo.name,
      status: 'waiting',
      progress: 0,
    };

    createdJobs.push(job);
    activeJobs[projectId].push(job);

    // Add task to render queue
    renderQueue.push({
      jobId,
      projectId,
      photoUrl: photo.url,
      photoPath: path.join(UPLOADS_DIR, path.basename(photo.url)),
      photoName: photo.name,
      templateConfig,
      outputPath,
      outputFilename,
    });
  });

  // Start queue processing
  processQueue();
  res.json({ success: true, jobs: createdJobs });
});

// API Endpoint to check render status of a project
app.get('/api/projects/:projectId/status', (req, res) => {
  const { projectId } = req.params;
  const jobs = activeJobs[projectId] || [];
  res.json({ jobs });
});

// API Endpoint to retry a failed job
app.post('/api/projects/:projectId/jobs/:jobId/retry', (req, res) => {
  const { projectId, jobId } = req.params;
  const { templateConfig, photo, filenamePrefix, index } = req.body;

  const existingJob = activeJobs[projectId]?.find((j) => j.id === jobId);
  if (!existingJob) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const padIndex = String(index + 1).padStart(3, '0');
  const outputFilename = `${filenamePrefix || 'ANXHH_Y2K'}_${padIndex}.mp4`;
  const outputPath = path.join(RENDERS_DIR, outputFilename);

  // Reset job parameters
  existingJob.status = 'waiting';
  existingJob.progress = 0;
  existingJob.error = undefined;
  existingJob.outputPath = undefined;

  // Append back to queue
  renderQueue.push({
    jobId,
    projectId,
    photoUrl: photo.url,
    photoPath: path.join(UPLOADS_DIR, path.basename(photo.url)),
    photoName: photo.name,
    templateConfig,
    outputPath,
    outputFilename,
  });

  processQueue();
  res.json({ success: true, job: existingJob });
});

// API Endpoint to export completed renders as a ZIP
app.get('/api/projects/:projectId/zip', (req, res) => {
  const { projectId } = req.params;
  const jobs = activeJobs[projectId] || [];
  const completedJobs = jobs.filter((j) => j.status === 'completed' && j.outputPath);

  if (completedJobs.length === 0) {
    return res.status(400).json({ error: 'No completed video files to zip' });
  }

  const zipFilename = `Y2K_Reels_${projectId}_${Date.now()}.zip`;
  const zipPath = path.join(RENDERS_DIR, zipFilename);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`[ZIP] Created ZIP archive: ${zipFilename} (${archive.pointer()} total bytes)`);
    res.json({
      downloadUrl: `/renders/${zipFilename}`,
      zipFilename,
    });
  });

  archive.on('error', (err) => {
    res.status(500).json({ error: 'Failed to create ZIP: ' + err.message });
  });

  archive.pipe(output);

  completedJobs.forEach((job) => {
    const filename = path.basename(job.outputPath!);
    const filepath = path.join(RENDERS_DIR, filename);
    if (fs.existsSync(filepath)) {
      archive.file(filepath, { name: filename });
    }
  });

  archive.finalize();
});

// Serve temp ZIP directories
app.use('/temp', express.static(TEMP_DIR));

// Fallback HTML page / Static Client Serving
const DIST_DIR = path.resolve('./dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.send(`
      <html>
        <head><title>Y2K Reel Maker API</title></head>
        <body style="font-family: monospace; background: #000; color: #fff; padding: 40px;">
          <h2>Y2K Reel Maker Rendering Service</h2>
          <p>This is the Express backend for compositing and encoding. Connect via the Vite dev server.</p>
        </body>
      </html>
    `);
  });
}

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Y2K Reel Maker Backend Running on Port ${PORT}`);
  console.log(`🚀 Local endpoint: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
