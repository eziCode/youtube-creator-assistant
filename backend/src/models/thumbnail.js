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

export async function generateThumbnail(prompt, outputPath) {
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
        console.log("[thumbnail] generated image with OpenAI images API ->", outputPath);
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
      const result = await hf.textToImage({ model, inputs: prompt });

      if (!result) {
        throw new Error("No result from textToImage");
      }

      const arrayBuffer = typeof result.arrayBuffer === "function" ? await result.arrayBuffer() : null;

      if (!arrayBuffer) {
        throw new Error("Unexpected result shape from textToImage");
      }

      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(outputPath, buffer);
      console.log(`[thumbnail] generated image with HF model ${model} -> ${outputPath}`);
      return;
    } catch (err) {
      console.warn(`[thumbnail] HF model ${model} failed:`, err?.message || err);
      lastErr = err;
    }
  }

  const message = lastErr?.message || "Failed to generate thumbnail with available providers.";
  throw new Error(message);
}