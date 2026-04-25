import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { getDriveClientForUser, getDriveWriteClientForUser } from './google-client.js'
import { Readable } from 'stream'

const BLOCKED_DRIVE_IDS = new Set(
  (process.env.BLOCKED_DRIVE_IDS || '0AB7-vkCNPC-3Uk9PVA')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

function isBlockedDriveId(driveId: string | null | undefined): boolean {
  return !!driveId && BLOCKED_DRIVE_IDS.has(driveId)
}

async function assertFileNotBlocked(drive: any, fileId: string): Promise<void> {
  const meta = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, driveId, parents',
  })
  if (isBlockedDriveId(meta.data.driveId)) {
    throw new Error('このファイルは機密情報ドライブに属しているためアクセスできません')
  }
}

// Drive tool definitions
export const driveTools: Tool[] = [
  {
    name: 'google_drive_list',
    description: 'ファイル・フォルダ一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'フォルダID（デフォルト: マイドライブのルート）' },
        max_results: { type: 'number', description: '取得件数（デフォルト: 20）', default: 20 },
        order_by: { type: 'string', description: 'ソート順（例: "modifiedTime desc", "name"）' },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
    },
  },
  {
    name: 'google_drive_search',
    description: 'ファイルを検索します。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索クエリ（例: "name contains \'報告書\'"）' },
        max_results: { type: 'number', description: '取得件数（デフォルト: 20）', default: 20 },
        mime_type: { type: 'string', description: 'MIMEタイプでフィルタ（例: "application/pdf"）' },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['query'],
    },
  },
  {
    name: 'google_drive_get_file',
    description: 'ファイルの詳細情報を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'ファイルID' },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'google_drive_get_content',
    description: 'テキストファイルの内容を取得します（Google Docsはプレーンテキストでエクスポート）。',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'ファイルID' },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'google_drive_share',
    description: 'ファイルやフォルダを共有します。メールアドレスを指定してアクセス権限を付与します。',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'ファイルまたはフォルダのID' },
        email: { type: 'string', description: '共有先のメールアドレス' },
        role: { type: 'string', description: 'ロール（reader, commenter, writer）', default: 'reader' },
        send_notification: { type: 'boolean', description: '通知メールを送信するか（デフォルト: false）', default: false },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['file_id', 'email', 'role'],
    },
  },
  {
    name: 'google_drive_list_shared_drives',
    description: 'アクセス可能な共有ドライブ（TeamDrive）の一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: '取得件数（デフォルト: 50）', default: 50 },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
    },
  },
  {
    name: 'google_drive_upload_file',
    description: 'URLからファイルをダウンロードしてGoogle Driveにアップロードします。SlackファイルURLやその他のHTTPアクセス可能なURLに対応。',
    inputSchema: {
      type: 'object',
      properties: {
        source_url: { type: 'string', description: 'アップロード元のURL（SlackファイルURLなど）' },
        file_name: { type: 'string', description: 'アップロード先のファイル名' },
        folder_id: { type: 'string', description: 'アップロード先のGoogle DriveフォルダID' },
        mime_type: { type: 'string', description: 'ファイルのMIMEタイプ（省略時は自動判定）' },
        auth_header: { type: 'string', description: '認証ヘッダー（例: "Bearer xoxb-xxx"）。SlackファイルURLの場合に必要' },
      },
      required: ['source_url', 'file_name', 'folder_id'],
    },
  },
]

// Helper to format file size
function formatFileSize(bytes: string | number | null | undefined): string {
  if (!bytes) return '不明'
  const size = typeof bytes === 'string' ? parseInt(bytes) : bytes
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

// Drive tool executor
export async function executeDriveTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const userEmail = args?.user_email as string | undefined
  const drive = getDriveClientForUser(userEmail)

  try {
    switch (name) {
      case 'google_drive_list': {
        const folderId = args?.folder_id as string | undefined
        const maxResults = (args?.max_results as number) || 20
        const orderBy = (args?.order_by as string) || 'modifiedTime desc'

        if (folderId) {
          await assertFileNotBlocked(drive, folderId)
        }

        let query = 'trashed = false'
        if (folderId) {
          query += ` and '${folderId}' in parents`
        }

        const response = await drive.files.list({
          q: query,
          pageSize: maxResults,
          orderBy,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'allDrives',
          fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, owners, driveId)',
        })

        const files = response.data.files?.filter((f) => !isBlockedDriveId(f.driveId)).map((file) => ({
          id: file.id,
          名前: file.name,
          タイプ: file.mimeType?.includes('folder') ? 'フォルダ' : 'ファイル',
          MIMEタイプ: file.mimeType,
          サイズ: formatFileSize(file.size),
          更新日時: file.modifiedTime,
          作成日時: file.createdTime,
          リンク: file.webViewLink,
          所有者: file.owners?.map((o) => o.emailAddress).join(', ') || '',
          共有ドライブID: file.driveId || '',
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: files.length, ファイル: files }, null, 2) }],
        }
      }

      case 'google_drive_search': {
        const query = args?.query as string
        const maxResults = (args?.max_results as number) || 20
        const mimeType = args?.mime_type as string | undefined

        if (!query) throw new Error('query is required')

        let q = `trashed = false and ${query}`
        if (mimeType) {
          q += ` and mimeType = '${mimeType}'`
        }

        const response = await drive.files.list({
          q,
          pageSize: maxResults,
          orderBy: 'modifiedTime desc',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'allDrives',
          fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, owners, driveId)',
        })

        const files = response.data.files?.filter((f) => !isBlockedDriveId(f.driveId)).map((file) => ({
          id: file.id,
          名前: file.name,
          タイプ: file.mimeType?.includes('folder') ? 'フォルダ' : 'ファイル',
          MIMEタイプ: file.mimeType,
          サイズ: formatFileSize(file.size),
          更新日時: file.modifiedTime,
          作成日時: file.createdTime,
          リンク: file.webViewLink,
          所有者: file.owners?.map((o) => o.emailAddress).join(', ') || '',
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 検索クエリ: query, 総件数: files.length, ファイル: files }, null, 2) }],
        }
      }

      case 'google_drive_get_file': {
        const fileId = args?.file_id as string
        if (!fileId) throw new Error('file_id is required')

        const response = await drive.files.get({
          fileId,
          supportsAllDrives: true,
          fields: 'id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, description, owners, permissions, parents, driveId',
        })

        const file = response.data
        if (isBlockedDriveId(file.driveId)) {
          throw new Error('このファイルは機密情報ドライブに属しているためアクセスできません')
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: file.id,
              名前: file.name,
              MIMEタイプ: file.mimeType,
              サイズ: formatFileSize(file.size),
              説明: file.description || '',
              更新日時: file.modifiedTime,
              作成日時: file.createdTime,
              閲覧リンク: file.webViewLink,
              ダウンロードリンク: file.webContentLink,
              所有者: file.owners?.map((o) => o.emailAddress).join(', ') || '',
              親フォルダ: file.parents || [],
              権限: file.permissions?.map((p) => ({
                タイプ: p.type,
                ロール: p.role,
                メール: p.emailAddress,
              })) || [],
            }, null, 2),
          }],
        }
      }

      case 'google_drive_get_content': {
        const fileId = args?.file_id as string
        if (!fileId) throw new Error('file_id is required')

        // First get file metadata to check mime type
        const metadata = await drive.files.get({
          fileId,
          supportsAllDrives: true,
          fields: 'id, name, mimeType, driveId',
        })

        if (isBlockedDriveId(metadata.data.driveId)) {
          throw new Error('このファイルは機密情報ドライブに属しているためアクセスできません')
        }

        const mimeType = metadata.data.mimeType

        let content: string

        if (mimeType === 'application/vnd.google-apps.document') {
          // Google Docs - export as plain text
          const response = await drive.files.export({
            fileId,
            mimeType: 'text/plain',
          })
          content = response.data as string
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Google Sheets - export as CSV
          const response = await drive.files.export({
            fileId,
            mimeType: 'text/csv',
          })
          content = response.data as string
        } else if (mimeType?.startsWith('text/') || mimeType === 'application/json') {
          // Text files - download directly
          const response = await drive.files.get({
            fileId,
            alt: 'media',
          })
          content = response.data as string
        } else {
          throw new Error(`このファイルタイプ（${mimeType}）はテキストとして取得できません`)
        }

        // Truncate if too long
        const maxLength = 50000
        const truncated = content.length > maxLength
        const displayContent = truncated ? content.substring(0, maxLength) + '\n\n... (truncated)' : content

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: metadata.data.id,
              名前: metadata.data.name,
              MIMEタイプ: mimeType,
              内容: displayContent,
              切り詰め: truncated,
            }, null, 2),
          }],
        }
      }

      case 'google_drive_share': {
        const fileId = args?.file_id as string
        const email = args?.email as string
        const role = args?.role as string
        const sendNotification = (args?.send_notification as boolean) ?? false

        if (!fileId) throw new Error('file_id is required')
        if (!email) throw new Error('email is required')
        if (!role) throw new Error('role is required')

        await assertFileNotBlocked(drive, fileId)

        const driveWrite = getDriveWriteClientForUser(userEmail)

        const permResponse = await driveWrite.permissions.create({
          fileId,
          supportsAllDrives: true,
          sendNotificationEmail: sendNotification,
          requestBody: {
            type: 'user',
            role,
            emailAddress: email,
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              成功: true,
              権限: {
                id: permResponse.data.id,
                タイプ: permResponse.data.type,
                ロール: permResponse.data.role,
                メール: email,
              },
            }, null, 2),
          }],
        }
      }

      case 'google_drive_list_shared_drives': {
        const maxResults = (args?.max_results as number) || 50

        const response = await drive.drives.list({
          pageSize: maxResults,
          fields: 'drives(id, name, createdTime, capabilities)',
        })

        const drives = response.data.drives?.filter((d) => !isBlockedDriveId(d.id)).map((d) => ({
          id: d.id,
          名前: d.name,
          作成日時: d.createdTime,
          書き込み可能: d.capabilities?.canEdit ?? false,
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: drives.length, 共有ドライブ: drives }, null, 2) }],
        }
      }

      case 'google_drive_upload_file': {
        const sourceUrl = args?.source_url as string
        const fileName = args?.file_name as string
        const folderId = args?.folder_id as string
        const mimeType = args?.mime_type as string | undefined
        const authHeader = args?.auth_header as string | undefined

        if (!sourceUrl) throw new Error('source_url is required')
        if (!fileName) throw new Error('file_name is required')
        if (!folderId) throw new Error('folder_id is required')

        await assertFileNotBlocked(drive, folderId)

        // Use write client for uploads
        const driveWrite = getDriveWriteClientForUser(userEmail)

        // Download file from URL
        const headers: Record<string, string> = {}
        if (authHeader) {
          headers['Authorization'] = authHeader
        }

        const downloadResponse = await fetch(sourceUrl, { headers })
        if (!downloadResponse.ok) {
          throw new Error(`ファイルのダウンロードに失敗: ${downloadResponse.status} ${downloadResponse.statusText}`)
        }

        const contentType = mimeType || downloadResponse.headers.get('content-type') || 'application/octet-stream'
        const arrayBuffer = await downloadResponse.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to Google Drive
        const uploadResponse = await driveWrite.files.create({
          requestBody: {
            name: fileName,
            parents: [folderId],
          },
          media: {
            mimeType: contentType,
            body: Readable.from(buffer),
          },
          supportsAllDrives: true,
          fields: 'id, name, mimeType, size, webViewLink',
        })

        const uploadedFile = uploadResponse.data

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              成功: true,
              ファイル: {
                id: uploadedFile.id,
                名前: uploadedFile.name,
                MIMEタイプ: uploadedFile.mimeType,
                サイズ: formatFileSize(uploadedFile.size),
                リンク: uploadedFile.webViewLink,
              },
            }, null, 2),
          }],
        }
      }

      default:
        throw new Error(`Unknown drive tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ エラー: error.message }, null, 2) }],
      isError: true,
    }
  }
}
