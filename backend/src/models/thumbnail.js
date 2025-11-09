import { google } from "googleapis";
import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import os from "os";
import dotenv from "dotenv";
dotenv.config();

const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
      // fallthrough to OpenAI approach
    }
  }

  // Use OpenAI image generation (primary method)
  if (!openaiClient) {
    throw new Error("OPENAI_API_KEY is required for thumbnail generation");
  }

  try {
    let enhancedPrompt = prompt;
    
    // If an input image was provided, analyze it and incorporate it into the prompt
      if (inputImagePath && fs.existsSync(inputImagePath)) {
      console.log("[thumbnail] analyzing input image to incorporate into generation:", inputImagePath);
      try {
        // Read the input image
        const imageBuffer = fs.readFileSync(inputImagePath);
        const imageBase64 = imageBuffer.toString('base64');
        
        // Determine MIME type from file extension
        const fileExt = inputImagePath.toLowerCase().split('.').pop();
        const mimeType = fileExt === 'png' ? 'image/png' : 
                        fileExt === 'jpg' || fileExt === 'jpeg' ? 'image/jpeg' : 
                        fileExt === 'webp' ? 'image/webp' : 'image/png';
        
        // Use Vision API to analyze the image with detailed facial feature analysis
        const visionModel = process.env.OPENAI_VISION_MODEL || "gpt-4o";
        
        // First, get detailed facial analysis if there's a person
        const facialAnalysisPrompt = `Analyze this image in extreme detail, focusing on facial features if a person is present. For any faces visible, describe with precision:
1. FACE SHAPE: Round, oval, square, heart-shaped, etc.
2. EYES: Exact shape (almond, round, narrow, wide-set), color, size, spacing between eyes, eyebrow shape and thickness
3. NOSE: Shape (straight, curved, wide, narrow), size, nostril shape
4. MOUTH/LIPS: Size, shape, fullness, lip line
5. CHEEKBONES: Prominent, flat, high, low
6. JAWLINE: Sharp, rounded, square, pointed chin
7. HAIR: Color, texture, style, length, hairline shape
8. SKIN TONE: Specific shade and undertones
9. DISTINCTIVE FEATURES: Any unique marks, moles, freckles, scars, or characteristics that make this person recognizable
10. FACIAL EXPRESSION: Current expression, eye direction
11. POSE/ANGLE: Head position, body orientation

Be extremely specific and detailed. This description will be used to recreate this exact person's face in a new image, so accuracy is critical.`;
        
        const visionResponse = await openaiClient.chat.completions.create({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: facialAnalysisPrompt
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        });
        
        const facialDescription = visionResponse.choices[0]?.message?.content || "";
        console.log("[thumbnail] detailed facial analysis:", facialDescription);
        
        // Get general image context
        const contextResponse = await openaiClient.chat.completions.create({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Describe the clothing, body pose, background, and overall style of this image. Keep it brief."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 200
        });
        
        const contextDescription = contextResponse.choices[0]?.message?.content || "";
        const imageDescription = `${facialDescription}\n\nAdditional context: ${contextDescription}`;
        console.log("[thumbnail] full image analysis:", imageDescription);
        
      } catch (visionErr) {
        console.warn("[thumbnail] Vision API analysis failed, using original prompt:", visionErr?.message || visionErr);
      }
    }

    // Calculate where the person will be placed (with random variation)
    // We'll use this info to generate a scene that accommodates the person
    // Store placement info for later use in compositing
    let placementInfo = null;
    if (inputImagePath && fs.existsSync(inputImagePath)) {
      const targetSize = process.env.THUMBNAIL_SIZE || "1792x1024";
      const [targetWidth, targetHeight] = targetSize.split('x').map(Number);
      
      // Calculate person placement area (random, but in right portion)
      const rightAreaStartPercent = 0.25 + Math.random() * 0.25; // 25-50% from left
      const rightAreaStart = Math.floor(targetWidth * rightAreaStartPercent);
      const personAreaWidthPercent = 0.3 + Math.random() * 0.2; // 30-50% width for person
      const personAreaWidth = Math.floor(targetWidth * personAreaWidthPercent);
      const personVerticalStartPercent = 0.05 + Math.random() * 0.1; // 5-15% from top
      const personVerticalStart = Math.floor(targetHeight * personVerticalStartPercent);
      const personVerticalEndPercent = 0.85 + Math.random() * 0.1; // 85-95% from top
      const personVerticalEnd = Math.floor(targetHeight * personVerticalEndPercent);
      
      placementInfo = {
        rightAreaStart,
        rightAreaStartPercent,
        personAreaWidth,
        personAreaWidthPercent,
        personVerticalStart,
        personVerticalStartPercent,
        personVerticalEnd,
        personVerticalEndPercent,
        targetWidth,
        targetHeight
      };
      
      // Generate scene WITH knowledge of where person will be placed
      enhancedPrompt = `${prompt}. 

COMPOSITION GUIDELINES FOR YOUTUBE THUMBNAIL:
- The main video topic/scene should be the primary focus, occupying the center and left portions of the image
- IMPORTANT: A person will be composited onto this image in the RIGHT SIDE area (approximately ${Math.floor(rightAreaStartPercent * 100)}-${Math.floor((rightAreaStartPercent + personAreaWidthPercent) * 100)}% from the left, vertically from ${Math.floor(personVerticalStartPercent * 100)}% to ${Math.floor(personVerticalEndPercent * 100)}% from the top)
- Design the scene so it looks natural with a person in that area - leave appropriate space, ensure good visual flow, and make sure the scene complements where the person will be placed
- The scene should create depth and context that makes sense with a person standing in that position
- Create a dynamic, eye-catching composition that follows YouTube thumbnail best practices: bold visuals, clear subject, good contrast
- Do NOT include any people in this image - focus only on the scene/topic, but design it knowing a person will be added

IMPORTANT: Show the complete, full image from top to bottom and left to right. Ensure all elements are fully visible within the frame - nothing should be cropped or cut off at the edges. The entire scene must be contained within the image boundaries.`;
    } else {
      // Even without input image, ensure full composition is visible
      enhancedPrompt = `${prompt}. IMPORTANT: Show the complete, full image from top to bottom and left to right. Ensure all elements are fully visible within the frame - nothing should be cropped or cut off at the edges. The entire scene must be contained within the image boundaries.`;
    }

    // Generate new image with OpenAI DALL-E
    const openaiModel = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
    // Use landscape size for better thumbnail aspect ratio (16:9 equivalent)
    // DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
    // DALL-E 2 supports: 256x256, 512x512, 1024x1024
    let imageSize = process.env.THUMBNAIL_SIZE;
    if (!imageSize) {
      imageSize = openaiModel === "dall-e-2" ? "1024x1024" : "1792x1024";
    }
    
    console.log(`[thumbnail] attempting OpenAI image generation with ${openaiModel}, size: ${imageSize}`);
      const imgResp = await openaiClient.images.generate({
      model: openaiModel,
      prompt: enhancedPrompt,
      size: imageSize,
      response_format: "b64_json",
      n: 1,
      });

      const b64 = imgResp?.data?.[0]?.b64_json;
      if (b64) {
        const buffer = Buffer.from(b64, "base64");
      const scenePath = path.join(os.tmpdir(), `yca_scene_${Date.now()}.png`);
      fs.writeFileSync(scenePath, buffer);
      
      // If input image provided, composite the person onto the scene
      if (inputImagePath && fs.existsSync(inputImagePath) && placementInfo) {
        try {
          console.log("[thumbnail] compositing person from input image onto generated scene");
          await compositePersonOntoScene(inputImagePath, scenePath, outputPath, imageSize, placementInfo);
          // Clean up temp scene file
          try { fs.unlinkSync(scenePath); } catch (e) { /* ignore */ }
        } catch (compositeErr) {
          console.warn("[thumbnail] compositing failed, using scene only:", compositeErr?.message || compositeErr);
          // Fallback: use the scene without compositing
          fs.copyFileSync(scenePath, outputPath);
          try { fs.unlinkSync(scenePath); } catch (e) { /* ignore */ }
        }
      } else {
        // No input image, just use the generated scene
        fs.copyFileSync(scenePath, outputPath);
        try { fs.unlinkSync(scenePath); } catch (e) { /* ignore */ }
      }
      
        try {
          const stats = fs.statSync(outputPath);
        console.log(`[thumbnail] final image saved -> ${outputPath} (${stats.size} bytes)`);
        } catch (sErr) {
          console.log('[thumbnail] wrote image but failed to stat file', sErr);
        }
        return;
      } else {
        console.warn("[thumbnail] OpenAI images response missing b64_json", imgResp?.data);
      throw new Error("OpenAI API returned no image data");
      }
    } catch (err) {
    console.error("[thumbnail] OpenAI image generation failed:", err?.message || err);
    // Fallback: create an SVG thumbnail including the prompt and uploaded image (if any)
    try {
      const uploadedB64 = inputImagePath && fs.existsSync(inputImagePath) ? fs.readFileSync(inputImagePath).toString('base64') : null;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
        `<rect width='100%' height='100%' fill='#0b1220'/>` +
        `${uploadedB64 ? `<image href='data:image/*;base64,${uploadedB64}' x='820' y='430' width='320' height='220' preserveAspectRatio='xMidYMid slice'/>` : ''}` +
        `<rect x='0' y='520' width='1200' height='155' fill='rgba(0,0,0,0.5)'/>` +
        `<text x='24' y='578' fill='#fff' font-size='36' font-family='sans-serif' dominant-baseline='middle'>${escapeXml(prompt).slice(0, 120)}</text>` +
        `</svg>`;

      fs.writeFileSync(outputPath, svg);
      console.warn('[thumbnail] OpenAI failed; wrote SVG fallback ->', outputPath);
      return;
    } catch (fallbackErr) {
      throw new Error(`OpenAI image generation failed and fallback also failed: ${err.message}`);
    }
  }
}



/**
 * Composites a person from input image onto the generated scene
 * Expects the input image to be a transparent PNG
 * Places person using the same placement info used in prompt generation
 */
async function compositePersonOntoScene(personImagePath, scenePath, outputPath, targetSize, placementInfo) {
  try {
    // Parse target dimensions
    const [targetWidth, targetHeight] = targetSize.split('x').map(Number);
    
    // Load both images
    const scene = sharp(scenePath);
    const person = sharp(personImagePath);
    
    // Get scene dimensions
    const sceneMetadata = await scene.metadata();
    const sceneWidth = sceneMetadata.width || targetWidth;
    const sceneHeight = sceneMetadata.height || targetHeight;
    
    // Get person image dimensions
    const personMetadata = await person.metadata();
    const personWidth = personMetadata.width || 1;
    const personHeight = personMetadata.height || 1;
    
    // Use the same placement info that was used in prompt generation
    const rightAreaStart = placementInfo.rightAreaStart;
    const rightAreaWidth = placementInfo.personAreaWidth;
    const personAreaHeight = placementInfo.personVerticalEnd - placementInfo.personVerticalStart;
    
    // Calculate scaling to fit person in the available area while maintaining aspect ratio
    const scaleX = rightAreaWidth / personWidth;
    const scaleY = personAreaHeight / personHeight;
    const baseScale = Math.min(scaleX, scaleY);
    
    // Add some variation to scale (70% to 100% of base scale) for natural sizing
    const scaleVariation = 0.7 + Math.random() * 0.3; // Random between 0.7 and 1.0
    const scale = baseScale * scaleVariation;
    
    const scaledPersonWidth = Math.floor(personWidth * scale);
    const scaledPersonHeight = Math.floor(personHeight * scale);
    
    // Position person within the designated area with some variation
    // Horizontal: center within the right area with slight variation
    const maxHorizontalOffset = rightAreaWidth - scaledPersonWidth;
    const horizontalOffset = maxHorizontalOffset > 0 ? Math.floor(maxHorizontalOffset * (0.2 + Math.random() * 0.6)) : 0; // 20-80% of available space
    
    // Vertical: within the designated vertical range
    const verticalRange = personAreaHeight - scaledPersonHeight;
    const verticalOffset = verticalRange > 0 
      ? placementInfo.personVerticalStart + Math.floor(verticalRange * (0.1 + Math.random() * 0.8)) // 10-90% of vertical range
      : placementInfo.personVerticalStart;
    
    const x = rightAreaStart + horizontalOffset;
    const y = verticalOffset;
    
    // Use person image directly (should already be transparent PNG)
    console.log("[thumbnail] using person image directly (expected to be transparent PNG)");
    
    // Resize person to calculated dimensions
    const personBuffer = await sharp(personImagePath)
      .resize(scaledPersonWidth, scaledPersonHeight, {
        fit: 'inside',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    // Composite person onto scene
    await scene
      .composite([{
        input: personBuffer,
        left: x,
        top: y,
        blend: 'over' // Standard alpha blending
      }])
      .toFile(outputPath);
    
    console.log(`[thumbnail] composited person at position (${x}, ${y}) with size ${scaledPersonWidth}x${scaledPersonHeight}, scale variation: ${scaleVariation.toFixed(2)}`);
  } catch (err) {
    console.error("[thumbnail] compositing error:", err?.message || err);
    throw err;
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