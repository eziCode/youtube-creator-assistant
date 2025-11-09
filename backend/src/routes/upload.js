import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const router = express.Router();

// Store uploads in OS temp dir with a yca_ prefix.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, os.tmpdir());
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, `yca_uploaded_${Date.now()}${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024), // default 5MB
  },
});

// Single-file upload endpoint: returns the temp path where file was written.
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Return the path to the saved file. This is used by /generate to compose thumbnails.
    // Note: for a production system you'd return a secure token or store the file in durable storage.
    return res.json({ uploadedImagePath: req.file.path });
  } catch (err) {
    console.error('[upload] upload failed', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

export default router;
