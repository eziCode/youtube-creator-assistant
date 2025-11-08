import { HfInference } from "@huggingface/inference";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const hf = new HfInference(process.env.HF_API_KEY);

export async function generateThumbnail(prompt, outputPath) {
  const result = await hf.textToImage({
    model: "runwayml/stable-diffusion-v1-5",
    inputs: prompt,
  });

  const buffer = Buffer.from(await result.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}