import { GoogleGenAI } from '@google/genai';
import * as whitelist from './whitelist.ts';

export interface GroundingFuente {
  title: string;
  uri: string;
  dominio: string | null;
  enListaBlanca: boolean;
}

export interface ResultadoVerificacionSearch {
  verificado: boolean;
  confianza: number;
  resumen: string;
  sitioSugerido: string;
  valores: {
    temperatura: number | null;
    presion: number | null;
    viento: number | null;
    luz: number | null;
    hora: number;
  };
  fuentes: GroundingFuente[];
  enListaBlanca: boolean;
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

function extraerJsonDeTexto(texto: string): Record<string, unknown> | null {
  const trimmed = texto.trim();
  const bloque = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
  const candidato = bloque ? bloque[1].trim() : trimmed;
  try {
    return JSON.parse(candidato) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verificarConGoogleSearch(params: {
  consulta: string;
  sitio?: string;
  sourceUrl?: string;
  temperatura?: number | null;
  presion?: number | null;
  viento?: number | null;
  luz?: number | null;
}): Promise<ResultadoVerificacionSearch> {
  const ai = getAiClient();

  const dominiosOficiales = whitelist
    .listarListaBlanca()
    .filter((d) => d.activo === 1)
    .map((d) => d.dominio)
    .slice(0, 10)
    .join(', ');

  const prompt = [
    `Verifica científicamente la siguiente observación o consulta ambiental planetaria usando Google Search:`,
    `Sitio objetivo: ${params.sitio || 'No especificado'}`,
    `Consulta / dato propuesto: ${params.consulta}`,
    params.sourceUrl ? `URL de referencia propuesta: ${params.sourceUrl}` : '',
    params.temperatura != null ? `Temperatura propuesta (K): ${params.temperatura}` : '',
    params.presion != null ? `Presión propuesta (Pa): ${params.presion}` : '',
    params.viento != null ? `Viento propuesto (m/s): ${params.viento}` : '',
    params.luz != null ? `Irradiancia solar propuesta (W/m²): ${params.luz}` : '',
    `Prioriza fuentes oficiales como: ${dominiosOficiales}.`,
    `Responde EXCLUSIVAMENTE con un bloque JSON válido (sin texto adicional fuera del JSON) con estas claves:`,
    `{`,
    `  "verificado": boolean,`,
    `  "confianza": number (0.0 a 1.0),`,
    `  "resumen": string (explicación breve y rigurosa en español de máximo 400 caracteres),`,
    `  "sitioSugerido": string,`,
    `  "temperatura": number | null (en Kelvin, rango 0..1000),`,
    `  "presion": number | null (en Pascales, rango 0..10000000),`,
    `  "viento": number | null (en m/s, rango 0..150),`,
    `  "luz": number | null (en W/m2, rango 0..1500),`,
    `  "hora": number (hora local aproximada 0..24)`,
    `}`,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction:
        'Eres un auditor de datos geofísicos y planetarios (Tierra, Luna, Marte). Contrastas mediciones en unidades SI (Kelvin, Pascales, m/s, W/m²) usando Google Search Grounding y devuelves JSON limpio y preciso.',
    },
  });

  const text = response.text ?? '';
  const parsed = extraerJsonDeTexto(text);

  const rawChunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const fuentes: GroundingFuente[] = [];
  const vistos = new Set<string>();

  for (const ch of rawChunks) {
    const uri = ch.web?.uri;
    if (!uri || vistos.has(uri)) continue;
    vistos.add(uri);
    const check = whitelist.verificarEnListaBlanca(uri);
    fuentes.push({
      title: ch.web?.title || check.dominioDetectado || uri,
      uri,
      dominio: check.dominioDetectado,
      enListaBlanca: check.enListaBlanca,
    });
  }

  const checkUrlPropuesta = params.sourceUrl
    ? whitelist.verificarEnListaBlanca(params.sourceUrl)
    : { enListaBlanca: false, dominioDetectado: null, entrada: null };

  const enListaBlanca =
    checkUrlPropuesta.enListaBlanca || fuentes.some((f) => f.enListaBlanca);

  const numOrNull = (val: unknown, fallback: number | null | undefined, min: number, max: number) => {
    if (typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max) {
      return val;
    }
    if (
      typeof fallback === 'number' &&
      Number.isFinite(fallback) &&
      fallback >= min &&
      fallback <= max
    ) {
      return fallback;
    }
    return null;
  };

  return {
    verificado: Boolean(parsed?.verificado ?? fuentes.length > 0),
    confianza:
      typeof parsed?.confianza === 'number'
        ? Math.max(0, Math.min(1, parsed.confianza))
        : enListaBlanca
          ? 0.94
          : 0.75,
    resumen:
      typeof parsed?.resumen === 'string' && parsed.resumen.trim()
        ? parsed.resumen.trim().slice(0, 600)
        : text.slice(0, 400) || 'Verificación completada mediante Google Search.',
    sitioSugerido:
      typeof parsed?.sitioSugerido === 'string' && parsed.sitioSugerido.trim()
        ? parsed.sitioSugerido.trim()
        : params.sitio || 'Tierra (Atacama, 2400 m)',
    valores: {
      temperatura: numOrNull(parsed?.temperatura, params.temperatura, 0, 1000),
      presion: numOrNull(parsed?.presion, params.presion, 0, 10000000),
      viento: numOrNull(parsed?.viento, params.viento, 0, 150),
      luz: numOrNull(parsed?.luz, params.luz, 0, 1500),
      hora:
        typeof parsed?.hora === 'number' && Number.isFinite(parsed.hora)
          ? parsed.hora
          : 12,
    },
    fuentes,
    enListaBlanca,
    modelo: 'gemini-4-hydrogen',
  };
}
