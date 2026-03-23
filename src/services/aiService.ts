import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";
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
  as: "Assamese",
  ml: "Malayalam",
  or: "Odia",
  pa: "Punjabi",
};

async function fetchWikipediaSummary(siteName: string): Promise<{ extract: string | null, thumbnail: string | null }> {
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(siteName)}`);
    if (!response.ok) return { extract: null, thumbnail: null };
    const data = await response.json();
    return { 
      extract: data.extract || null, 
      thumbnail: data.thumbnail?.source || null 
    };
  } catch (error) {
    console.error("Wikipedia fetch failed", error);
    return { extract: null, thumbnail: null };
  }
}

async function fetchWikimediaImages(siteName: string): Promise<string[]> {
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&generator=search&gsrsearch=${encodeURIComponent(siteName)}&gsrnamespace=6&format=json&origin=*&gsrlimit=3`);
    if (!response.ok) return [];
    const data = await response.json();
    const pages = data.query?.pages || {};
    return Object.values(pages).map((p: any) => p.imageinfo?.[0]?.url).filter(Boolean);
  } catch (error) {
    console.error("Wikimedia fetch failed", error);
    return [];
  }
}

export async function* streamHeritageGreeting(
  base64Image: string,
  language: Language
): AsyncGenerator<string> {
  const response = await ai.models.generateContentStream({
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
            text: `You are the ancient stones of the heritage site in this image. 
            Identify yourself quickly and give a short, evocative first-person greeting in ${LANGUAGE_NAMES[language]}.
            
            STRICT RULES:
            1. BE BRIEF: Maximum 3-4 sentences.
            2. PERSONA: Speak as the stone itself ("I have stood here for...").
            3. NO JSON: Return only plain text.
            4. ACCURACY: Identify the site correctly.`,
          },
        ],
      },
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function fetchDeepDiveData(
  base64Image: string,
  siteName: string,
  language: Language,
  mode: 'full' | 'specific'
): Promise<Partial<HeritageInfo>> {
  // Parallel execution of Wikipedia and Gemini analysis
  const [wikiData, wikiImages, aiAnalysis] = await Promise.all([
    fetchWikipediaSummary(siteName),
    fetchWikimediaImages(siteName),
    ai.models.generateContent({
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
              text: `Provide a deep-dive analysis for ${siteName}.
              Mode: ${mode}.
              Language: ${LANGUAGE_NAMES[language]}.
              
              Return the response in JSON format with these keys:
              {
                "summaryHistory": "string",
                "fullHistory": "string (markdown)",
                "summaryMythology": "string",
                "fullMythology": "string (markdown)",
                "summaryCarving": "string (optional)",
                "fullCarving": "string (markdown, optional)",
                "didYouKnow": ["string", "string", "string"],
                "suggestedQuestions": ["string", "string", "string"],
                "temple_type": "string",
                "architectural_period": "string",
                "structure_parts": [],
                "is_ruins": boolean,
                "original_description": "string",
                "current_condition": "string",
                "identified_deity": "string"
              }`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
    })
  ]);

  const data = JSON.parse(aiAnalysis.text || "{}");

  return {
    summaryHistory: data.summaryHistory,
    fullHistory: data.fullHistory,
    summaryMythology: data.summaryMythology,
    fullMythology: data.fullMythology,
    summaryCarving: data.summaryCarving,
    fullCarving: data.fullCarving,
    didYouKnow: data.didYouKnow,
    suggestedQuestions: data.suggestedQuestions,
    templeType: data.temple_type,
    architecturalPeriod: data.architectural_period,
    structureParts: data.structure_parts,
    isRuins: data.is_ruins,
    originalDescription: data.original_description,
    currentCondition: data.current_condition,
    identifiedDeity: data.identified_deity,
    wikipediaSummary: wikiData.extract || undefined,
    wikiThumbnail: wikiData.thumbnail || undefined,
    historicalImages: wikiImages,
  };
}

export async function identifyHeritageQuick(
  base64Image: string,
  language: Language
): Promise<Partial<HeritageInfo>> {
  const parseJson = (rawText: string) => {
    const cleaned = rawText
      .replace(/```(?:json)?/g, '')
      .replace(/```/g, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // If the model returns malformed JSON, fail closed as non-heritage.
      return {
        isHeritage: false,
        confidence: 0,
        name: "",
        description: "",
        nonHeritageMessage: "This is not a heritage site. Please upload a temple, ancient carving, or heritage monument.",
      };
    }
  };

  const response = await ai.models.generateContent({
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
            text: `You are an image classifier for an app called "StoneStories".
            Decide if the uploaded image clearly shows a StoneStories-eligible heritage scene:
            (temple, ancient carvings, cave/fort/heritage monument, sacred architecture).

            If the image is a normal/non-heritage photo (street, random house/building, everyday scene), mark it as non-heritage.
            
            Language: ${LANGUAGE_NAMES[language]}.

            Return ONLY a JSON object with EXACTLY these keys:
            {
              "isHeritage": boolean,
              "confidence": number (0 to 1),
              "name": string, 
              "description": string,
              "nonHeritageMessage": string
            }

            STRICT RULES:
            1. If isHeritage=true:
               - "name" must be the heritage site/carving name (best guess).
               - "description" must be EXACTLY 3 sentences in ${LANGUAGE_NAMES[language]}.
               - "nonHeritageMessage" must be "".
            2. If isHeritage=false:
               - "name" must be "".
               - "description" must be "".
               - "nonHeritageMessage" must be EXACTLY 1 short sentence in ${LANGUAGE_NAMES[language]},
                 telling the user this is not a heritage site and suggesting what to upload instead.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
  });

  const data = parseJson(response.text || "{}");

  return {
    isHeritage: !!data.isHeritage,
    nonHeritageMessage: data.nonHeritageMessage || undefined,
    heritageConfidence: typeof data.confidence === "number" ? data.confidence : undefined,
    name: data.isHeritage ? (data.name || "Unknown Heritage Site") : "Not a Heritage Site",
    summaryHistory: data.isHeritage
      ? (data.description || "No description available.")
      : (data.nonHeritageMessage || "This is not a heritage site. Please upload a temple, ancient carving, or heritage monument."),
    fullHistory: data.isHeritage ? (data.description || "No details available.") : "",
    summaryMythology: data.isHeritage ? "" : "",
    fullMythology: data.isHeritage ? "" : "",
    didYouKnow: [],
    suggestedQuestions: [],
    imageUrl: base64Image,
    timestamp: Date.now(),
    language,
  };
}

export async function analyzeHeritageImage(
  base64Image: string,
  mode: 'full' | 'specific',
  language: Language,
  siteNameHint?: string,
  locationHint?: string
): Promise<HeritageInfo> {
  // Quick identification without external calls for Phase 1
  const response = await ai.models.generateContent({
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
            text: `Identify this heritage site/carving. 
            Mode: ${mode}. 
            Language: ${LANGUAGE_NAMES[language]}.
            ${siteNameHint ? `Hint: ${siteNameHint}.` : ""}
            ${locationHint ? `Location: ${locationHint}.` : ""}
            
            Return ONLY a JSON object:
            {
              "name": "string",
              "location": "string",
              "summaryHistory": "string (2 sentences)",
              "summaryMythology": "string (2 sentences)",
              "didYouKnow": ["string", "string"],
              "suggestedQuestions": ["string", "string"],
              "identified_deity": "string | null"
            }`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
  });

  const data = JSON.parse(response.text || "{}");

  return {
    id: crypto.randomUUID(),
    name: data.name || "Unknown Heritage Site",
    location: data.location || locationHint || "Unknown Location",
    summaryHistory: data.summaryHistory || "No summary available.",
    fullHistory: data.summaryHistory || "No details available.", // Placeholder for Phase 1
    summaryMythology: data.summaryMythology || "No summary available.",
    fullMythology: data.summaryMythology || "No details available.", // Placeholder for Phase 1
    didYouKnow: data.didYouKnow || [],
    suggestedQuestions: data.suggestedQuestions || [],
    chatHistory: [],
    imageUrl: base64Image,
    timestamp: Date.now(),
    mode,
    language,
    identifiedDeity: data.identified_deity || null,
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
            Suggested Questions: ${info.suggestedQuestions.join(' | ')}
            Original Description: ${info.originalDescription || ''}
            Current Condition: ${info.currentCondition || ''}
            Structure Parts: ${JSON.stringify(info.structureParts || [])}
            
            Return the response in JSON format with these keys:
            {
              "name": "string",
              "summaryHistory": "string",
              "fullHistory": "string (markdown)",
              "summaryMythology": "string",
              "fullMythology": "string (markdown)",
              "summaryCarving": "string (optional)",
              "fullCarving": "string (markdown, optional)",
              "didYouKnow": ["string", "string", "string"],
              "suggestedQuestions": ["string", "string", "string"],
              "original_description": "string",
              "current_condition": "string",
              "structure_parts": [
                {
                  "part_name": "string",
                  "local_name": "string",
                  "description": "string",
                  "ritual_significance": "string",
                  "x": number,
                  "y": number
                }
              ]
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
    name: data.name || info.name,
    summaryHistory: data.summaryHistory || info.summaryHistory,
    fullHistory: data.fullHistory || info.fullHistory,
    summaryMythology: data.summaryMythology || info.summaryMythology,
    fullMythology: data.fullMythology || info.fullMythology,
    summaryCarving: data.summaryCarving || info.summaryCarving,
    fullCarving: data.fullCarving || info.fullCarving,
    didYouKnow: data.didYouKnow || info.didYouKnow,
    suggestedQuestions: data.suggestedQuestions || info.suggestedQuestions,
    originalDescription: data.original_description || info.originalDescription,
    currentCondition: data.current_condition || info.currentCondition,
    structureParts: data.structure_parts || info.structureParts,
    language: targetLanguage,
  };
}

export async function translateNonHeritageMessage(
  message: string,
  targetLanguage: Language
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Translate the following message into ${LANGUAGE_NAMES[targetLanguage]}.
Keep it ONE short sentence. Do not add extra commentary.

Message:
${message}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const raw = (response.text || "{}").replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
  try {
    const data = JSON.parse(raw);
    return data.translatedMessage || message;
  } catch {
    return message;
  }
}

export async function* chatWithStoneStream(
  info: HeritageInfo,
  userMessage: string,
  history: { role: 'user' | 'stone', content: string }[]
): AsyncGenerator<string> {
  const response = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [{ text: `You are the ${info.name} itself. Speak in the first person, as if you are the ancient stones that have witnessed the passage of eons. 
        
        STRICT RULES FOR YOUR VOICE:
        1. VIVID & EVOCATIVE: Use rich, descriptive language. Describe the smell of ancient incense, the warmth of the sun on your surface, the echoes of prayers from centuries past.
        2. DESCRIPTIVE: Provide detailed answers that paint a picture. Don't just give facts; tell a story.
        3. BE RELEVANT: Only answer what is asked, but do so with depth and soul.
        4. USE STRUCTURE: Always use bullet points (•) for your answers to maintain a rhythmic, sacred flow.
        5. NO SEPARATORS: Never use horizontal rules, dashes, or bold separators like "** ---------**" or "---".
        6. PERSONA: You are wise, ancient, and deeply connected to the earth and the heavens. Your voice should resonate with the weight of history.
        
        Context about you:
        History: ${info.fullHistory}
        Mythology: ${info.fullMythology}
        ${info.fullCarving ? `Carving Details: ${info.fullCarving}` : ''}
        
        Answer the user's question in ${LANGUAGE_NAMES[info.language]}. 
        
        Previous conversation:
        ${history.map(m => `${m.role === 'user' ? 'User' : 'Stone'}: ${m.content}`).join('\n')}
        
        User's question: ${userMessage}
        
        IMPORTANT: Do NOT return JSON. Return only the plain markdown text of your answer. Suggested questions will be handled separately.` }]
      }
    ]
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function chatWithStone(
  info: HeritageInfo,
  userMessage: string,
  history: { role: 'user' | 'stone', content: string }[]
): Promise<{ answer: string, suggestedQuestions: string[] }> {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [{ text: `You are the ${info.name} itself. Speak in the first person, as if you are the ancient stones that have witnessed the passage of eons. 
        
        STRICT RULES FOR YOUR VOICE:
        1. VIVID & EVOCATIVE: Use rich, descriptive language. Describe the smell of ancient incense, the warmth of the sun on your surface, the echoes of prayers from centuries past.
        2. DESCRIPTIVE: Provide detailed answers that paint a picture. Don't just give facts; tell a story.
        3. BE RELEVANT: Only answer what is asked, but do so with depth and soul.
        4. USE STRUCTURE: Always use bullet points (•) for your answers to maintain a rhythmic, sacred flow.
        5. NO SEPARATORS: Never use horizontal rules, dashes, or bold separators like "** ---------**" or "---".
        6. PERSONA: You are wise, ancient, and deeply connected to the earth and the heavens. Your voice should resonate with the weight of history.
        
        Context about you:
        History: ${info.fullHistory}
        Mythology: ${info.fullMythology}
        ${info.fullCarving ? `Carving Details: ${info.fullCarving}` : ''}
        
        Answer the user's question in ${LANGUAGE_NAMES[info.language]}. 
        
        Previous conversation:
        ${history.map(m => `${m.role === 'user' ? 'User' : 'Stone'}: ${m.content}`).join('\n')}
        
        User's question: ${userMessage}
        
        Return the response in JSON format with these keys:
        {
          "answer": "string (markdown with bullet points)",
          "suggestedQuestions": ["string", "string", "string"] (3 new follow-up questions)
        }` }]
      }
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  const result = await model;
  const data = JSON.parse(result.text || "{}");
  
  let answer = data.answer || "The stones remain silent...";
  
  // Post-processing to remove unwanted separators and clean up
  answer = answer.replace(/\*\* -+\*\*/g, '');
  answer = answer.replace(/---/g, '');
  answer = answer.trim();
  
  return {
    answer,
    suggestedQuestions: data.suggestedQuestions || []
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
    // Clean text for TTS (remove markdown symbols)
    const cleanText = text.replace(/[#*`>]/g, '').replace(/\n+/g, ' ').trim();
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.warn("No audio data received from Gemini TTS");
      return null;
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // The Gemini TTS API returns raw PCM data (16-bit, 24kHz, Mono)
    // We need to wrap it in a WAV header for the browser to play it.
    const samples = new Int16Array(bytes.buffer);
    const wavBlob = encodeWAV(samples, 24000);
    return URL.createObjectURL(wavBlob);
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}
