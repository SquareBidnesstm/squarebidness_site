import { GoogleGenAI } from "@google/genai";

export const evolveImage = async (
  baseImageBase64: string | null,
  userPrompt: string
): Promise<string> => {
  // Initialize inside the function to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    You are the Lead Visual Engineer for Square Bidness Tech Lab. 
    Your task is to evolve a user-provided workspace photo into a professional 1200x630 (aspect ratio 16:9) Open Graph meta image.
    
    Brand Guidelines:
    - Primary Aesthetic: Midnight Black (#020617) with "International Orange" (#f97316) highlights.
    - Vibe: Louisiana engineering grit, veteran-owned, high-end infrastructure.
    - Elements: Clean surfaces, cinematic lighting, modern hardware (Mac/Studio displays).
    
    Execution:
    1. Analyze the composition of the uploaded photo.
    2. Maintain the core layout but "upgrade" the environment to look like a high-end engineering lab.
    3. Ensure a "SQUARE BIDNESS TECH LAB" or "SB" branding appears naturally on screens or as a subtle watermark.
    4. Focus on sharp detail and professional depth of field.
  `;

  const textPart = {
    text: `${systemInstruction}\n\nUser Vision: ${userPrompt}`
  };

  const parts: any[] = [textPart];

  if (baseImageBase64) {
    const base64Data = baseImageBase64.includes(',') 
      ? baseImageBase64.split(',')[1] 
      : baseImageBase64;
      
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts }],
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  // Find the image part in the response
  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error("The Lab couldn't render the asset. Please try again.");
};
