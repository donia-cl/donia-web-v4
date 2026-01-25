
import { logger } from './_utils.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { error, context, url, userAgent } = req.body;
    
    logger.error('CLIENT_SIDE_EXCEPTION', new Error(error.message || 'Client Error'), {
      context,
      client_stack: error.stack,
      url,
      userAgent
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
}
