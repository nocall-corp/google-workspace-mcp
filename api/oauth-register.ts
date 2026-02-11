import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBaseUrl } from '../lib/oauth.js'
import { randomBytes } from 'node:crypto'

/**
 * OAuth Dynamic Client Registration (RFC 7591)
 * Required by MCP spec for clients that don't have pre-registered credentials.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const body = req.body || {}
  const clientName = body.client_name || 'mcp-client'
  const redirectUris = body.redirect_uris || []
  const grantTypes = body.grant_types || ['authorization_code']
  const responseTypes = body.response_types || ['code']
  const tokenEndpointAuthMethod = body.token_endpoint_auth_method || 'client_secret_post'

  // Generate client credentials
  const clientId = `mcp_${randomBytes(16).toString('hex')}`
  // Note: client_secret is not the MCP auth token.
  // The actual auth happens via the authorization_code flow where
  // the authorize endpoint auto-approves.
  const clientSecret = randomBytes(32).toString('hex')

  const baseUrl = getBaseUrl(req)

  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    registration_client_uri: `${baseUrl}/oauth/register/${clientId}`,
  })
}
