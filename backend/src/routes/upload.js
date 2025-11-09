import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';

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
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const apiKey = process.env.REMOVE_BG_API_KEY;
    let processedPath = req.file.path;
    let backgroundRemoved = false;

    if (apiKey) {
      const formData = new FormData();
      formData.append('image_file', fs.createReadStream(req.file.path));
      formData.append('size', 'auto');

      try {
        const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
          responseType: 'arraybuffer',
          headers: {
            ...formData.getHeaders(),
            'X-Api-Key': apiKey,
          },
          timeout: Number(process.env.REMOVE_BG_TIMEOUT_MS || 20000),
        });

        const cleanedPath = path.join(
          os.tmpdir(),
          `yca_uploaded_${Date.now()}_${Math.random().toString(36).slice(2,8)}_clean.png`
        );
        fs.writeFileSync(cleanedPath, response.data);

        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.warn('[upload] Failed to remove original uploaded file after background removal', unlinkErr);
        }

        processedPath = cleanedPath;
        backgroundRemoved = true;
      } catch (removeErr) {
        const detail =
          removeErr?.response?.data?.errors?.[0]?.title ||
          removeErr?.response?.data?.errors?.[0]?.detail ||
          removeErr?.response?.data ||
          removeErr?.message ||
          removeErr;
        console.error('[upload] remove.bg request failed', detail);
      }
    } else {
      console.warn('[upload] REMOVE_BG_API_KEY not set; returning original image without background removal');
    }

    // Return the path to the processed file. This is used by /generate to compose thumbnails.
    // Note: for a production system you'd return a secure token or store the file in durable storage.
    return res.json({ uploadedImagePath: processedPath, backgroundRemoved });
  } catch (err) {
    console.error('[upload] upload failed', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

export default router;
