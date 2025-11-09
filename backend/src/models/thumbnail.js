import { HfInference } from "@huggingface/inference";
import { google } from "googleapis";
import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const hf = new HfInference(process.env.HF_API_KEY);

const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Try multiple candidate models that the Inference API can serve.
const MODEL_CANDIDATES = [
  "stabilityai/stable-diffusion-2",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
];

function findBase64InObject(obj) {
  if (!obj) return null;
  if (typeof obj === "string") {
    // Heuristic: long base64 strings (no spaces) or data URI
    if (/^data:image\/.+;base64,/.test(obj)) return obj.split(",")[1];
    if (/^[A-Za-z0-9+/=\n\r]{200,}$/.test(obj.replace(/\s+/g, ""))) return obj.replace(/\s+/g, "");
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findBase64InObject(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      const found = findBase64InObject(obj[k]);
      if (found) return found;
    }
  }
  return null;
}

export async function generateThumbnail(prompt, outputPath, inputImagePath = null) {
  // Try Google Vertex AI if configured
  const project = process.env.GOOGLE_PROJECT_ID;
  const location = process.env.GOOGLE_LOCATION || "us-central1";
  const gModel = process.env.GOOGLE_THUMBNAIL_MODEL || "image-bison";

  if (project) {
    try {
      console.log(`[thumbnail] attempting Google Vertex AI image generation (project=${project}, location=${location}, model=${gModel})`);

      const authClient = await google.auth.getClient({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const accessTokenRes = await authClient.getAccessToken();
      const accessToken = typeof accessTokenRes === "string" ? accessTokenRes : accessTokenRes?.token;

      if (!accessToken) throw new Error("Failed to obtain access token for Google Cloud");

      // Construct URL. Try the publisher path first, then the model resource path.
      const base = `${location}-aiplatform.googleapis.com`;
      const candidateUrls = [
        `https://${base}/v1/projects/${project}/locations/${location}/publishers/google/models/${gModel}:predict`,
        `https://${base}/v1/projects/${project}/locations/${location}/models/${gModel}:predict`,
      ];

      let lastErr = null;
      for (const url of candidateUrls) {
        try {
          const body = {
            instances: [{ prompt }],
            parameters: { // tuning params; may be ignored depending on endpoint
              image_format: "png",
            },
          };

          const resp = await axios.post(url, body, {
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            timeout: 120000,
          });

          // Try to find base64 image in the response
          const base64 = findBase64InObject(resp.data);
          if (!base64) {
            // Some endpoints return a 'predictions' array with 'content' fields
            console.warn("[thumbnail] no base64 image found in response; response keys:", Object.keys(resp.data || {}));
            throw new Error("No image content found in Vertex AI response");
          }

          const buffer = Buffer.from(base64, "base64");
          fs.writeFileSync(outputPath, buffer);
          console.log(`[thumbnail] generated image with Vertex AI model ${gModel} -> ${outputPath}`);
          return;
        } catch (err) {
          console.warn(`[thumbnail] Vertex AI URL ${url} failed:`, err?.message || err);
          lastErr = err;
        }
      }

      throw lastErr || new Error("Vertex AI image generation failed");
    } catch (err) {
      console.warn("[thumbnail] Google Vertex AI generation failed:", err?.message || err);
      // fallthrough to HF approach
    }
  }

  // Fallback: try Hugging Face inference models
  // Try OpenAI image generation if configured
  if (openaiClient) {
    try {
      // If an input image was provided, prefer the OpenAI image edits (img->img)
      if (inputImagePath && fs.existsSync(inputImagePath)) {
        console.log("[thumbnail] attempting OpenAI image edit (image->image) using", inputImagePath);
        const imgStream = fs.createReadStream(inputImagePath);
        try {
          const editResp = await openaiClient.images.edit({
            model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
            image: imgStream,
            prompt,
            size: "1024x1024",
          });

          const b64 = editResp?.data?.[0]?.b64_json;
          if (b64) {
            const buffer = Buffer.from(b64, "base64");
            fs.writeFileSync(outputPath, buffer);
            console.log("[thumbnail] generated edited image with OpenAI images.edit ->", outputPath);
            return;
          }
        } catch (editErr) {
          console.warn("[thumbnail] OpenAI image edit failed:", editErr?.message || editErr);
          // fall through to generation attempt
        }
      }

      console.log("[thumbnail] attempting OpenAI image generation (images API)");
      const imgResp = await openaiClient.images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt,
        size: "1024x1024",
      });

      const b64 = imgResp?.data?.[0]?.b64_json;
      if (b64) {
        const buffer = Buffer.from(b64, "base64");
        fs.writeFileSync(outputPath, buffer);
        try {
          const stats = fs.statSync(outputPath);
          console.log(`[thumbnail] generated image with OpenAI images API -> ${outputPath} (${stats.size} bytes)`);
          // log first few bytes for quick inspection
          console.log('[thumbnail] generated image first bytes:', buffer.slice(0, 8).toString('hex'));
        } catch (sErr) {
          console.log('[thumbnail] wrote image but failed to stat file', sErr);
        }
        return;
      } else {
        console.warn("[thumbnail] OpenAI images response missing b64_json", imgResp?.data);
      }
    } catch (err) {
      console.warn("[thumbnail] OpenAI image generation failed:", err?.message || err);
      // fall through to HF models
    }
  }

  let lastErr = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      console.log(`[thumbnail] attempting Hugging Face textToImage with model ${model}`);
      // First try the HfInference helper
      let result = null;
      try {
        result = await hf.textToImage({ model, inputs: prompt });
      } catch (hfErr) {
        console.warn(`[thumbnail] HfInference.textToImage failed for ${model}:`, hfErr?.message || hfErr);
        // some errors indicate no provider available; we'll fall back to the direct REST inference API
      }

      // If hf.textToImage returned a result, try to extract bytes
      if (result) {
        const arrayBuffer = typeof result.arrayBuffer === "function" ? await result.arrayBuffer() : null;
        if (!arrayBuffer) {
          throw new Error("Unexpected result shape from textToImage");
        }
        const buffer = Buffer.from(arrayBuffer);
        // If there's an uploaded image, compose into SVG; otherwise write the buffer
        if (inputImagePath && fs.existsSync(inputImagePath)) {
          try {
            const uploadedB64 = fs.readFileSync(inputImagePath).toString('base64');
            const genB64 = buffer.toString('base64');
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
              `<rect width='100%' height='100%' fill='#111827'/>` +
              `<image href='data:image/png;base64,${genB64}' x='0' y='0' width='1200' height='675' preserveAspectRatio='xMidYMid slice'/>` +
              `<image href='data:image/*;base64,${uploadedB64}' x='820' y='430' width='320' height='220' preserveAspectRatio='xMidYMid slice'/>` +
              `<rect x='0' y='520' width='1200' height='155' fill='rgba(0,0,0,0.45)'/>` +
              `<text x='24' y='578' fill='#fff' font-size='36' font-family='sans-serif' dominant-baseline='middle'>${escapeXml(prompt).slice(0, 120)}</text>` +
              `</svg>`;
            fs.writeFileSync(outputPath, svg);
            console.log(`[thumbnail] generated SVG composite (HF ${model} + uploaded) -> ${outputPath}`);
            return;
          } catch (e) {
            console.warn(`[thumbnail] failed to create SVG composite with uploaded image (HF ${model}):`, e?.message || e);
          }
        }
        fs.writeFileSync(outputPath, buffer);
        console.log(`[thumbnail] generated image with HF model ${model} -> ${outputPath}`);
        return;
      }

      // If hf.textToImage didn't work, try the REST inference API as a fallback
      try {
        console.log(`[thumbnail] attempting Hugging Face REST inference for model ${model}`);
        const hfApiKey = process.env.HF_API_KEY;
        if (!hfApiKey) throw new Error('No HF_API_KEY configured');
        const url = `https://api-inference.huggingface.co/models/${model}`;
        const resp = await axios.post(url, { inputs: prompt, options: { wait_for_model: true } }, {
          headers: { Authorization: `Bearer ${hfApiKey}` },
          responseType: 'arraybuffer',
          timeout: 120000,
        });

        if (resp && resp.data) {
          const buffer = Buffer.from(resp.data);
          if (inputImagePath && fs.existsSync(inputImagePath)) {
            try {
              const uploadedB64 = fs.readFileSync(inputImagePath).toString('base64');
              const genB64 = buffer.toString('base64');
              const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                `<rect width='100%' height='100%' fill='#111827'/>` +
                `<image href='data:image/png;base64,${genB64}' x='0' y='0' width='1200' height='675' preserveAspectRatio='xMidYMid slice'/>` +
                `<image href='data:image/*;base64,${uploadedB64}' x='820' y='430' width='320' height='220' preserveAspectRatio='xMidYMid slice'/>` +
                `<rect x='0' y='520' width='1200' height='155' fill='rgba(0,0,0,0.45)'/>` +
                `<text x='24' y='578' fill='#fff' font-size='36' font-family='sans-serif' dominant-baseline='middle'>${escapeXml(prompt).slice(0, 120)}</text>` +
                `</svg>`;
              fs.writeFileSync(outputPath, svg);
              console.log(`[thumbnail] generated SVG composite (HF REST ${model} + uploaded) -> ${outputPath}`);
              return;
            } catch (e) {
              console.warn(`[thumbnail] failed to create SVG composite with uploaded image (HF REST ${model}):`, e?.message || e);
            }
          }
          fs.writeFileSync(outputPath, buffer);
          console.log(`[thumbnail] generated image with HF REST model ${model} -> ${outputPath}`);
          return;
        }
      } catch (restErr) {
        console.warn(`[thumbnail] HF REST inference failed for ${model}:`, restErr?.message || restErr);
        lastErr = restErr;
      }

    } catch (err) {
      console.warn(`[thumbnail] HF model ${model} failed:`, err?.message || err);
      lastErr = err;
    }
  }

  // Final fallback: create an SVG thumbnail including the prompt and uploaded image (if any)
  try {
    const uploadedB64 = inputImagePath && fs.existsSync(inputImagePath) ? fs.readFileSync(inputImagePath).toString('base64') : null;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
      `<rect width='100%' height='100%' fill='#0b1220'/>` +
      `${uploadedB64 ? `<image href='data:image/*;base64,${uploadedB64}' x='820' y='430' width='320' height='220' preserveAspectRatio='xMidYMid slice'/>` : ''}` +
      `<rect x='0' y='520' width='1200' height='155' fill='rgba(0,0,0,0.5)'/>` +
      `<text x='24' y='578' fill='#fff' font-size='36' font-family='sans-serif' dominant-baseline='middle'>${escapeXml(prompt).slice(0, 120)}</text>` +
      `</svg>`;

    fs.writeFileSync(outputPath, svg);
    console.warn('[thumbnail] All providers failed; wrote SVG fallback ->', outputPath);
    return;
  } catch (e) {
    const message = lastErr?.message || 'Failed to generate thumbnail with available providers.';
    throw new Error(message);
  }
}

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&"']/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
    }
  });
}