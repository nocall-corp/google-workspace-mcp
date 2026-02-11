import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAuthCode } from '../lib/oauth.js'

/**
 * OAuth Authorization Endpoint
 * Auto-approves and redirects back with authorization code.
 * Supports PKCE (S256).
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const {
    client_id,
    redirect_uri,
    response_type,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query as Record<string, string>

  // Validate required params
  if (response_type !== 'code') {
    return res.status(400).json({ error: 'unsupported_response_type' })
  }
  if (!client_id || !redirect_uri) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'client_id and redirect_uri are required' })
  }

  // Generate authorization code (JWT-based, stateless)
  const code = createAuthCode({
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method || 'S256',
  })

  // Build redirect URL
  const redirectUrl = new URL(redirect_uri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  res.redirect(302, redirectUrl.toString())
}
