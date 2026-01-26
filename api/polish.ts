
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('AI_CONFIG_MISSING', new Error('OPENAI_API_KEY no configurada en Vercel'));
      return res.status(503).json({ error: 'El servicio de IA no está disponible en este momento.' });
    }

    logger.info('AI_POLISH_REQUEST_OPENAI', { ip, storyLength: story.length });

    // Llamada directa a OpenAI mediante fetch para evitar dependencias extras
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en redacción para crowdfunding solidario. Tu única función es mejorar el texto del usuario para que sea más claro, empático y profesional, manteniendo un tono chileno cercano y honesto. REGLAS CRÍTICAS: 1. NO inventes hechos ni nombres. 2. NO exageres ni uses lenguaje melodramático falso. 3. MANTÉN la veracidad de la historia original. 4. SOLO entrega el texto mejorado, sin introducciones ni comentarios explicativos.'
          },
          {
            role: 'user',
            content: `Mejora el siguiente texto para una campaña solidaria en Donia:\n\n"${story}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('OPENAI_API_ERROR', errorData);
      throw new Error('Error en la comunicación con OpenAI');
    }

    const data = await response.json();
    const polishedText = data.choices?.[0]?.message?.content;

    if (!polishedText) {
      throw new Error('La IA devolvió una respuesta vacía.');
    }

    logger.info('AI_POLISH_SUCCESS', { newLength: polishedText.length });
    return res.status(200).json({ text: polishedText.trim() });

  } catch (error: any) {
    logger.error('AI_POLISH_FATAL_ERROR', error);
    
    const clientMessage = error.message.includes('Demasiadas solicitudes') 
      ? 'Has realizado demasiadas solicitudes. Por favor, espera un minuto.' 
      : 'Hubo un problema al procesar tu historia con la IA. Por favor, inténtalo de nuevo.';

    return res.status(500).json({ error: clientMessage });
  }
}
