import { GoogleGenAI } from "@google/genai";
import { Validator, logger, checkRateLimit } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ip = req.headers['x-forwarded-for'] || 'unknown';
    // Limitar a 10 solicitudes por minuto para evitar abusos
    checkRateLimit(String(ip), 10, 60000); 

    const { story } = req.body;
    Validator.required(story, 'story');
    Validator.string(story, 20, 'story');

    // Using process.env.API_KEY as per the @google/genai guidelines
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      logger.error('AI_CONFIG_MISSING', new Error('API_KEY no configurada en el entorno'));
      return res.status(503).json({ error: 'El servicio de IA no está configurado correctamente.' });
    }

    logger.info('AI_POLISH_REQUEST_GEMINI', { ip, storyLength: story.length });

    // Initialization using the recommended method
    const ai = new GoogleGenAI({ apiKey });
    
    // Using gemini-3-flash-preview for proofreading and text improvement tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un experto en redacción para crowdfunding solidario. Tu única función es mejorar el texto del usuario para que sea más claro, empático y profesional, manteniendo un tono chileno cercano y honesto. REGLAS CRÍTICAS: 1. NO inventes hechos ni nombres. 2. NO exageres ni uses lenguaje melodramático falso. 3. MANTÉN la veracidad de la historia original. 4. SOLO entrega el texto mejorado, sin introducciones ni comentarios explicativos.\n\nMejora el siguiente texto para una campaña solidaria en Donia:\n\n"${story}"`,
    });

    // Accessing text directly from the GenerateContentResponse object
    const polishedText = response.text;

    if (!polishedText) {
      throw new Error('La IA devolvió una respuesta vacía.');
    }

    logger.info('AI_POLISH_SUCCESS', { newLength: polishedText.length });
    return res.status(200).json({ text: polishedText.trim() });

  } catch (error: any) {
    logger.error('AI_POLISH_FATAL_ERROR', error);
    
    let clientMessage = 'Hubo un problema al procesar tu historia con la IA. Por favor, inténtalo de nuevo.';
    
    if (error.message.includes('Demasiadas solicitudes')) {
      clientMessage = error.message;
    } else if (error.message.includes('límite de uso')) {
      clientMessage = error.message;
    }

    return res.status(500).json({ error: clientMessage });
  }
}