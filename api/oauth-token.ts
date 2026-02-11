import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuthCode, verifyPKCE, validateClientSecret, getAccessToken } from '../lib/oauth.js'

/**
 * OAuth Token Endpoint
 * Supports: authorization_code (with PKCE) and client_credentials
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  // Parse body (application/x-www-form-urlencoded or JSON)
  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {}
  const grantType = body.grant_type

  // Also check Basic auth for client credentials
  let clientId = body.client_id
  let clientSecret = body.client_secret
  const authHeader = req.headers['authorization'] as string | undefined
  if (authHeader?.toLowerCase().startsWith('basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
    const [id, secret] = decoded.split(':')
    if (!clientId) clientId = id
    if (!clientSecret) clientSecret = secret
  }

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(body, clientId, clientSecret, res)
  } else if (grantType === 'client_credentials') {
    return handleClientCredentials(clientId, clientSecret, res)
  } else {
    return res.status(400).json({ error: 'unsupported_grant_type' })
  }
}

function handleAuthorizationCode(
  body: Record<string, string>,
  clientId: string,
  clientSecret: string,
  res: VercelResponse
) {
  const { code, code_verifier, redirect_uri } = body

  if (!code) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' })
  }

  // Verify authorization code
  const payload = verifyAuthCode(code)
  if (!payload) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' })
  }

  // Verify client_id matches
  if (clientId && payload.clientId !== clientId) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' })
  }

  // Verify redirect_uri matches
  if (redirect_uri && payload.redirectUri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' })
  }

  // Verify PKCE if code_challenge was provided
  if (payload.codeChallenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier is required' })
    }
    if (!verifyPKCE(code_verifier, payload.codeChallenge, payload.codeChallengeMethod)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' })
    }
  }

  // Issue access token (= our MCP auth token)
  const accessToken = getAccessToken()
  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 86400,
    scope: 'mcp:tools',
  })
}

function handleClientCredentials(clientId: string, clientSecret: string, res: VercelResponse) {
  if (!clientSecret) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'client_secret is required' })
  }

  if (!validateClientSecret(clientSecret)) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' })
  }

  const accessToken = getAccessToken()
  return res.status(200).json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 86400,
    scope: 'mcp:tools',
  })
}
