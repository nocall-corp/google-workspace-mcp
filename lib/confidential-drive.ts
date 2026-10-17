import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac, timingSafeEqual } from 'node:crypto'

// 機密情報共有ドライブ
const BLOCKED_DRIVE_IDS = new Set(
  (process.env.BLOCKED_DRIVE_IDS || '0AB7-vkCNPC-3Uk9PVA')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

const DEFAULT_USER = process.env.GOOGLE_DEFAULT_USER || process.env.GOOGLE_DELEGATED_USER || 'hayashi@nocall.ai'

// 機密ドライブを開けるのは「この人の依頼」かつ「この人のアカウントで開く」場合だけ（林さん・阿部さん）
const ALLOWED_EMAILS = new Set(
  (process.env.BLOCKED_DRIVE_ALLOWED_EMAILS || 'hayashi@nocall.ai,abe@nocall.ai')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
)

// gateway が依頼者ごとに署名して渡すトークン（X-Nokoru-Requester ヘッダ）の検証鍵
const SIGNING_SECRET = process.env.CONFIDENTIAL_DRIVE_SIGNING_SECRET || ''

export const REQUESTER_HEADER = 'x-nokoru-requester'

// リクエスト単位の「検証済み依頼者メール」（検証できなければ null）
const requesterStore = new AsyncLocalStorage<string | null>()

export function runWithRequester<T>(requester: string | null, fn: () => T): T {
  return requesterStore.run(requester, fn)
}

/**
 * トークン形式: base64url(JSON{ e: email, x: 有効期限(UNIX秒) }) + "." + base64url(HMAC-SHA256(payload))
 * 署名が正しく期限内なら依頼者メールを返す。それ以外は null。
 */
export function verifyRequesterToken(token: string | null | undefined, nowSec = Math.floor(Date.now() / 1000)): string | null {
  if (!SIGNING_SECRET || !token) return null
  const [payload, sig] = token.trim().split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', SIGNING_SECRET).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { e?: unknown; x?: unknown }
    if (typeof data.e !== 'string' || typeof data.x !== 'number' || data.x < nowSec) return null
    return data.e.trim().toLowerCase()
  } catch {
    return null
  }
}

function isAllowedAccess(userEmail: string | null | undefined): boolean {
  const account = (userEmail || DEFAULT_USER).trim().toLowerCase()
  const requester = requesterStore.getStore() ?? null
  return !!requester && ALLOWED_EMAILS.has(requester) && ALLOWED_EMAILS.has(account)
}

export function isBlockedDriveId(driveId: string | null | undefined, userEmail?: string | null): boolean {
  if (!driveId || !BLOCKED_DRIVE_IDS.has(driveId)) return false
  return !isAllowedAccess(userEmail)
}

export const BLOCKED_MESSAGE =
  'このファイルは機密情報ドライブに属しているためアクセスできません（林さん・阿部さんからの依頼で、本人のアカウントで開く場合のみ可）'

export async function assertFileNotBlocked(drive: any, fileId: string, userEmail?: string | null): Promise<void> {
  const meta = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, driveId, parents',
  })
  if (isBlockedDriveId(meta.data.driveId, userEmail)) {
    throw new Error(BLOCKED_MESSAGE)
  }
}
