import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'ok',
    service: 'google-workspace-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
}
