import { GoogleGenAI } from '@google/genai';

export interface MapsReviewSnippet {
  author: string | null;
  text: string;
  uri: string | null;
}

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  placeId: string | null;
  reviewSnippets: MapsReviewSnippet[];
}

export interface MapsGroundingResult {
  respuestaMarkdown: string;
  lugares: MapsGroundingPlace[];
  lat: number;
  lon: number;
  consulta: string;
  modelo: string;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function consultarGoogleMapsGrounding(params: {
  consulta: string;
  lat: number;
  lon: number;
}): Promise<MapsGroundingResult> {
  const ai = getAiClient();
  const lat = Math.max(-90, Math.min(90, Number(params.lat) || 0));
  const lon = Math.max(-180, Math.min(180, Number(params.lon) || 0));

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: params.consulta,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lon,
          },
        },
      },
      systemInstruction:
        'Eres un asistente de geografía y campo planetario. Responde en español claro y conciso usando datos reales de Google Maps sobre accidentes geográficos, estaciones científicas, rutas de acceso, elevación y puntos de referencia cercanos a las coordenadas proporcionadas.',
    },
  });

  const respuestaMarkdown =
    response.text?.trim() ||
    'No se recibió descripción textual para esta ubicación en Google Maps.';

  type RawMapsChunk = {
    maps?: {
      uri?: string;
      title?: string;
      placeId?: string;
      placeAnswerSources?: {
        reviewSnippets?: Array<{
          uri?: string;
          authorAttribution?: { displayName?: string };
          text?: string;
        }>;
      };
    };
  };

  const rawChunks =
    (response.candidates?.[0]?.groundingMetadata?.groundingChunks as
      | RawMapsChunk[]
      | undefined) ?? [];

  const vistos = new Set<string>();
  const lugares: MapsGroundingPlace[] = [];

  for (const ch of rawChunks) {
    const uri = ch.maps?.uri;
    if (!uri || vistos.has(uri)) continue;
    vistos.add(uri);

    const snippetsRaw = ch.maps?.placeAnswerSources?.reviewSnippets ?? [];
    const reviewSnippets: MapsReviewSnippet[] = snippetsRaw
      .filter((s) => Boolean(s.text || s.uri))
      .map((s) => ({
        author: s.authorAttribution?.displayName ?? null,
        text: (s.text ?? '').trim(),
        uri: s.uri ?? null,
      }));

    lugares.push({
      title: ch.maps?.title || uri,
      uri,
      placeId: ch.maps?.placeId ?? null,
      reviewSnippets,
    });
  }

  return {
    respuestaMarkdown,
    lugares,
    lat,
    lon,
    consulta: params.consulta,
    modelo: 'gemini-4-hydrogen',
  };
}
