import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBaseUrl, authServerMetadata } from '../lib/oauth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const baseUrl = getBaseUrl(req)
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(authServerMetadata(baseUrl))
}
