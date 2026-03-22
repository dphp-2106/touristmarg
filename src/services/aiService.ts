import { GoogleGenAI, Modality } from "@google/genai";
import { HeritageInfo, Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
  gu: "Gujarati",
  ta: "Tamil",
  bn: "Bengali",
  mr: "Marathi",
  te: "Telugu",
  kn: "Kannada",
};

export async function analyzeHeritageImage(
  base64Image: string,
  mode: 'full' | 'specific',
  language: Language,
  siteName?: string,
  location?: string
): Promise<HeritageInfo> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1],
            },
          },
          {
            text: `Analyze this heritage site image. 
            Mode: ${mode === 'full' ? 'Full Temple/Site' : 'Specific Carving/Wall/Artwork'}.
            Language: ${LANGUAGE_NAMES[language]}.
            ${siteName ? `User-provided Site Name: ${siteName}.` : ''}
            ${location ? `User-provided Location: ${location}.` : ''}
            Use the provided name and location to improve accuracy.
            
            IMPORTANT: Use Google Search to verify the identity of the site and fetch accurate historical and mythological details. Ensure the response is grounded in real-world facts.
            
            CRITICAL ACCURACY RULE: 
            - If mode is 'specific', ONLY explain the story and details of the EXACT carving/wall/artwork shown in the image. Do NOT give a general history of the entire temple complex unless it directly relates to this specific part. For example, if it's a wall in Ellora Cave 16, talk about that wall's specific story, not just the Kailash Temple in general.
            - If mode is 'full', provide a comprehensive overview of the entire site.
            
            Provide the following details in ${LANGUAGE_NAMES[language]} for each section (History, Mythology, and Carving Details):
            1. Name: The specific name of the site or the carving.
            2. Summary: A short (2-3 sentences) "Quick Highlights" of the most important but minor details.
            3. Deep Dive: An exhaustive, extremely detailed explanation. Use a combination of descriptive paragraphs and bullet points for key facts. Include who built it, exact dates/centuries, dynasty, materials, architectural style, purpose, and every minor detail possible.
            4. Special Facts: 3 unique, deeply interesting, or "special" things about this specific site/carving that are not commonly known.
            
            Return the response in JSON format with these keys:
            {
              "name": "string",
              "summaryHistory": "string",
              "fullHistory": "string (markdown)",
              "summaryMythology": "string",
              "fullMythology": "string (markdown)",
              "summaryCarving": "string (optional)",
              "fullCarving": "string (markdown, optional)",
              "didYouKnow": ["string", "string", "string"]
            }`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = await model;
  const data = JSON.parse(result.text || "{}");

  return {
    id: crypto.randomUUID(),
    name: data.name || "Unknown Heritage Site",
    location: location,
    summaryHistory: data.summaryHistory || "No summary available.",
    fullHistory: data.fullHistory || "No details available.",
    summaryMythology: data.summaryMythology || "No summary available.",
    fullMythology: data.fullMythology || "No details available.",
    summaryCarving: data.summaryCarving,
    fullCarving: data.fullCarving,
    didYouKnow: data.didYouKnow || [],
    imageUrl: base64Image,
    timestamp: Date.now(),
    mode,
    language,
  };
}

export async function translateHeritageInfo(
  info: HeritageInfo,
  targetLanguage: Language
): Promise<HeritageInfo> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Translate the following heritage information into ${LANGUAGE_NAMES[targetLanguage]}. 
            Keep the markdown formatting intact.
            
            Information to translate:
            Name: ${info.name}
            Summary History: ${info.summaryHistory}
            Full History: ${info.fullHistory}
            Summary Mythology: ${info.summaryMythology}
            Full Mythology: ${info.fullMythology}
            ${info.summaryCarving ? `Summary Carving: ${info.summaryCarving}` : ''}
            ${info.fullCarving ? `Full Carving: ${info.fullCarving}` : ''}
            Did You Know: ${info.didYouKnow.join(' | ')}
            
            Return the response in JSON format with these keys:
            {
              "name": "string",
              "summaryHistory": "string",
              "fullHistory": "string (markdown)",
              "summaryMythology": "string",
              "fullMythology": "string (markdown)",
              "summaryCarving": "string (optional)",
              "fullCarving": "string (markdown, optional)",
              "didYouKnow": ["string", "string", "string"]
            }`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const result = await model;
  const data = JSON.parse(result.text || "{}");

  return {
    ...info,
    name: data.name,
    summaryHistory: data.summaryHistory,
    fullHistory: data.fullHistory,
    summaryMythology: data.summaryMythology,
    fullMythology: data.fullMythology,
    summaryCarving: data.summaryCarving,
    fullCarving: data.fullCarving,
    didYouKnow: data.didYouKnow,
    language: targetLanguage,
  };
}

/**
 * Wraps raw PCM data in a WAV header so it can be played by the browser's <audio> tag.
 */
function encodeWAV(samples: Int16Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false);
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  view.setUint32(8, 0x57415645, false);
  /* format chunk identifier */
  view.setUint32(12, 0x666d7420, false);
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  view.setUint32(36, 0x64617461, false);
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function generateAudio(text: string, language: Language): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    // Convert base64 to Int16Array (assuming 16-bit PCM)
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const samples = new Int16Array(bytes.buffer);

    // Encode as WAV and create a URL
    const wavBlob = encodeWAV(samples, 24000);
    return URL.createObjectURL(wavBlob);
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}
