/**
 * OAuth utilities for MCP servers
 * Implements MCP Authorization spec (RFC 8414, RFC 9728)
 * Supports authorization_code (PKCE) and client_credentials flows
 */
import { createHmac, createHash, randomBytes } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

// --- Config ---

const getAuthTokens = (): string[] =>
  [process.env.MCP_AUTH_TOKEN, process.env.AUTH_TOKEN].filter(
    (t): t is string => typeof t === 'string' && t.length > 0
  )

export function getBaseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'localhost'
  return `${proto}://${host}`
}

// --- JWT-based authorization codes (stateless) ---

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createAuthCode(params: {
  clientId: string
  redirectUri: string
  codeChallenge?: string
  codeChallengeMethod?: string
}): string {
  const secret = getAuthTokens()[0] || 'fallback-secret'
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({
      ...params,
      exp: Date.now() + 10 * 60 * 1000, // 10 min
      iat: Date.now(),
      jti: randomBytes(16).toString('hex'),
    })
  ).toString('base64url')
  const signature = sign(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

export function verifyAuthCode(code: string): {
  clientId: string
  redirectUri: string
  codeChallenge?: string
  codeChallengeMethod?: string
} | null {
  const secret = getAuthTokens()[0] || 'fallback-secret'
  const parts = code.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expected = sign(`${header}.${body}`, secret)
  if (signature !== expected) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// --- PKCE ---

export function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string = 'S256'): boolean {
  if (method === 'S256') {
    const computed = createHash('sha256').update(codeVerifier).digest('base64url')
    return computed === codeChallenge
  }
  if (method === 'plain') {
    return codeVerifier === codeChallenge
  }
  return false
}

// --- Client validation ---

export function validateClientSecret(clientSecret: string): boolean {
  const tokens = getAuthTokens()
  return tokens.includes(clientSecret)
}

export function getAccessToken(): string {
  return getAuthTokens()[0] || ''
}

// --- Metadata builders ---

export function protectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
  }
}

export function authServerMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    scopes_supported: ['mcp:tools'],
  }
}
