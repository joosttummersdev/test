// This file is disabled/deprecated
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(404).json({ 
    error: 'This endpoint has been deprecated' 
  });
}