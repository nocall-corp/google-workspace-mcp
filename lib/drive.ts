import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { getDriveClient } from './google-client.js'

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
      },
      required: ['file_id'],
    },
  },
  {
    name: 'google_drive_get_content',
    description: 'テキストファイルの内容を取得します（Google DocsはプレーンテキストでエクスポートR）。',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'ファイルID' },
      },
      required: ['file_id'],
    },
  },
]

// Helper to format file size
function formatFileSize(bytes: string | number | undefined): string {
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
  const drive = getDriveClient()

  try {
    switch (name) {
      case 'google_drive_list': {
        const folderId = args?.folder_id as string | undefined
        const maxResults = (args?.max_results as number) || 20
        const orderBy = (args?.order_by as string) || 'modifiedTime desc'

        let query = 'trashed = false'
        if (folderId) {
          query += ` and '${folderId}' in parents`
        }

        const response = await drive.files.list({
          q: query,
          pageSize: maxResults,
          orderBy,
          fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, owners)',
        })

        const files = response.data.files?.map((file) => ({
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
          fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, owners)',
        })

        const files = response.data.files?.map((file) => ({
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
          fields: 'id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, description, owners, permissions, parents',
        })

        const file = response.data

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
          fields: 'id, name, mimeType',
        })

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
