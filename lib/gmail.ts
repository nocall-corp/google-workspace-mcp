import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { getGmailClientForUser, getDriveClientForUser, getImpersonatedUser } from './google-client.js'

// Gmail tool definitions
export const gmailTools: Tool[] = [
  {
    name: 'google_gmail_search',
    description: 'メールを検索します。Gmailの検索クエリ構文が使えます。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索クエリ（例: "from:example@example.com newer_than:7d"）' },
        max_results: { type: 'number', description: '取得件数（デフォルト: 20）', default: 20 },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['query'],
    },
  },
  {
    name: 'google_gmail_get_message',
    description: '特定のメールの詳細を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'メッセージID' },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'google_gmail_send',
    description: 'メールを送信します。Google Driveファイルの添付も可能です。',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '宛先メールアドレス' },
        subject: { type: 'string', description: '件名' },
        body: { type: 'string', description: '本文' },
        cc: { type: 'string', description: 'CC（カンマ区切り）' },
        bcc: { type: 'string', description: 'BCC（カンマ区切り）' },
        user_email: { type: 'string', description: '送信元メールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
        attachments: {
          type: 'array',
          description: 'Google Driveファイルの添付（ファイルIDまたはURL）',
          items: {
            type: 'object',
            properties: {
              drive_file_id: { type: 'string', description: 'Google DriveファイルID' },
              drive_url: { type: 'string', description: 'Google DriveファイルURL（例: https://docs.google.com/document/d/xxx/edit）' },
              filename: { type: 'string', description: 'ファイル名（省略時はDriveのファイル名を使用）' },
            },
          },
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'google_gmail_reply',
    description: 'メールに返信します。元のメールのスレッドに紐づけて返信します。Google Driveファイルの添付も可能です。',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: '返信元のメッセージID' },
        body: { type: 'string', description: '返信本文' },
        cc: { type: 'string', description: 'CC（カンマ区切り）' },
        bcc: { type: 'string', description: 'BCC（カンマ区切り）' },
        user_email: { type: 'string', description: '送信元メールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
        attachments: {
          type: 'array',
          description: 'Google Driveファイルの添付（ファイルIDまたはURL）',
          items: {
            type: 'object',
            properties: {
              drive_file_id: { type: 'string', description: 'Google DriveファイルID' },
              drive_url: { type: 'string', description: 'Google DriveファイルURL（例: https://docs.google.com/document/d/xxx/edit）' },
              filename: { type: 'string', description: 'ファイル名（省略時はDriveのファイル名を使用）' },
            },
          },
        },
      },
      required: ['message_id', 'body'],
    },
  },
  {
    name: 'google_gmail_list_labels',
    description: 'ラベル一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
    },
  },
  {
    name: 'google_gmail_modify_labels',
    description: 'メールのラベルを変更します。',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'メッセージID' },
        add_labels: { type: 'array', items: { type: 'string' }, description: '追加するラベルID' },
        remove_labels: { type: 'array', items: { type: 'string' }, description: '削除するラベルID' },
        user_email: { type: 'string', description: 'アクセス対象のメールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'google_gmail_create_draft',
    description: 'メールの下書きを作成してGmailの下書きフォルダに保存します。Google Driveファイルの添付も可能です。',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '宛先メールアドレス' },
        subject: { type: 'string', description: '件名' },
        body: { type: 'string', description: '本文' },
        cc: { type: 'string', description: 'CC（カンマ区切り）' },
        bcc: { type: 'string', description: 'BCC（カンマ区切り）' },
        user_email: { type: 'string', description: '送信元メールアドレス（@nocall.aiドメイン限定）。省略時は hayashi@nocall.ai' },
        in_reply_to_message_id: { type: 'string', description: '返信元のメッセージID（返信の下書きを作る場合）' },
        attachments: {
          type: 'array',
          description: 'Google Driveファイルの添付（ファイルIDまたはURL）',
          items: {
            type: 'object',
            properties: {
              drive_file_id: { type: 'string', description: 'Google DriveファイルID' },
              drive_url: { type: 'string', description: 'Google DriveファイルURL（例: https://docs.google.com/document/d/xxx/edit）' },
              filename: { type: 'string', description: 'ファイル名（省略時はDriveのファイル名を使用）' },
            },
          },
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
]

// Helper to decode base64url
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

// Helper to encode email to base64url
function encodeEmail(to: string, subject: string, body: string, fromEmail: string, cc?: string, bcc?: string): string {
  let email = `From: ${fromEmail}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nContent-Type: text/plain; charset=UTF-8\r\n`

  if (cc) email += `Cc: ${cc}\r\n`
  if (bcc) email += `Bcc: ${bcc}\r\n`

  email += `\r\n${body}`

  return Buffer.from(email).toString('base64url')
}

// Helper to encode reply email to base64url
function encodeReplyEmail(
  to: string,
  subject: string,
  body: string,
  inReplyTo: string,
  references: string,
  fromEmail: string,
  cc?: string,
  bcc?: string
): string {
  let email = `From: ${fromEmail}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nContent-Type: text/plain; charset=UTF-8\r\n`

  if (cc) email += `Cc: ${cc}\r\n`
  if (bcc) email += `Bcc: ${bcc}\r\n`
  if (inReplyTo) email += `In-Reply-To: ${inReplyTo}\r\n`
  if (references) email += `References: ${references}\r\n`

  email += `\r\n${body}`

  return Buffer.from(email).toString('base64url')
}

// Google Workspace MIME types and their export formats
const GOOGLE_EXPORT_MAP: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'application/pdf',
    extension: '.pdf',
  },
}

// Extract Google Drive file ID from URL
function extractDriveFileId(urlOrId: string): string {
  if (!urlOrId.includes('/')) return urlOrId
  const docMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (docMatch) return docMatch[1]
  const fileMatch = urlOrId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return fileMatch[1]
  const openMatch = urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (openMatch) return openMatch[1]
  return urlOrId
}

// Attachment info after downloading from Drive
interface AttachmentData {
  filename: string
  mimeType: string
  content: Buffer
}

// Download a file from Google Drive (handles both native and Google Workspace files)
async function downloadDriveFile(fileId: string, userEmail?: string, customFilename?: string): Promise<AttachmentData> {
  const drive = getDriveClientForUser(userEmail)

  const fileMeta = await drive.files.get({
    fileId,
    fields: 'name,mimeType',
    supportsAllDrives: true,
  })

  const originalMimeType = fileMeta.data.mimeType || 'application/octet-stream'
  const originalName = fileMeta.data.name || 'attachment'
  const exportConfig = GOOGLE_EXPORT_MAP[originalMimeType]

  let content: Buffer
  let mimeType: string
  let filename: string

  if (exportConfig) {
    const response = await drive.files.export(
      { fileId, mimeType: exportConfig.mimeType },
      { responseType: 'arraybuffer' }
    )
    content = Buffer.from(response.data as ArrayBuffer)
    mimeType = exportConfig.mimeType
    filename = customFilename || (originalName.endsWith(exportConfig.extension)
      ? originalName
      : `${originalName}${exportConfig.extension}`)
  } else {
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
    content = Buffer.from(response.data as ArrayBuffer)
    mimeType = originalMimeType
    filename = customFilename || originalName
  }

  return { filename, mimeType, content }
}

// Encode a MIME multipart email with attachments
function encodeEmailWithAttachments(
  to: string,
  subject: string,
  body: string,
  attachments: AttachmentData[],
  fromEmail: string,
  cc?: string,
  bcc?: string,
  inReplyTo?: string,
  references?: string
): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`

  let headers = `From: ${fromEmail}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n`

  if (cc) headers += `Cc: ${cc}\r\n`
  if (bcc) headers += `Bcc: ${bcc}\r\n`
  if (inReplyTo) headers += `In-Reply-To: ${inReplyTo}\r\n`
  if (references) headers += `References: ${references}\r\n`

  let email = `${headers}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n`

  for (const att of attachments) {
    const encodedFilename = `=?UTF-8?B?${Buffer.from(att.filename).toString('base64')}?=`
    email += `--${boundary}\r\nContent-Type: ${att.mimeType}; name="${encodedFilename}"\r\nContent-Disposition: attachment; filename="${encodedFilename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n`
    const base64 = att.content.toString('base64')
    for (let i = 0; i < base64.length; i += 76) {
      email += base64.slice(i, i + 76) + '\r\n'
    }
  }

  email += `--${boundary}--\r\n`
  return Buffer.from(email).toString('base64url')
}

// Helper to extract email headers
function getHeader(headers: any[], name: string): string {
  const header = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

// Gmail tool executor
export async function executeGmailTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const userEmail = args?.user_email as string | undefined
  const gmail = getGmailClientForUser(userEmail)
  const resolvedUser = getImpersonatedUser(userEmail)
  const userId = 'me'

  try {
    switch (name) {
      case 'google_gmail_search': {
        const query = args?.query as string
        const maxResults = (args?.max_results as number) || 20
        if (!query) throw new Error('query is required')

        const response = await gmail.users.messages.list({
          userId,
          q: query,
          maxResults,
        })

        const messages = await Promise.all(
          (response.data.messages || []).map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId,
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            })
            
            const headers = detail.data.payload?.headers || []
            
            return {
              id: msg.id,
              スレッドID: msg.threadId,
              送信者: getHeader(headers, 'From'),
              宛先: getHeader(headers, 'To'),
              件名: getHeader(headers, 'Subject'),
              日時: getHeader(headers, 'Date'),
              スニペット: detail.data.snippet || '',
              ラベル: detail.data.labelIds || [],
            }
          })
        )

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: messages.length, メール: messages }, null, 2) }],
        }
      }

      case 'google_gmail_get_message': {
        const messageId = args?.message_id as string
        if (!messageId) throw new Error('message_id is required')

        const response = await gmail.users.messages.get({
          userId,
          id: messageId,
          format: 'full',
        })

        const headers = response.data.payload?.headers || []
        
        // Extract body
        let body = ''
        const payload = response.data.payload
        if (payload?.body?.data) {
          body = decodeBase64Url(payload.body.data)
        } else if (payload?.parts) {
          const textPart = payload.parts.find((p) => p.mimeType === 'text/plain')
          if (textPart?.body?.data) {
            body = decodeBase64Url(textPart.body.data)
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: response.data.id,
              スレッドID: response.data.threadId,
              送信者: getHeader(headers, 'From'),
              宛先: getHeader(headers, 'To'),
              CC: getHeader(headers, 'Cc'),
              件名: getHeader(headers, 'Subject'),
              日時: getHeader(headers, 'Date'),
              本文: body,
              ラベル: response.data.labelIds || [],
              スニペット: response.data.snippet || '',
            }, null, 2),
          }],
        }
      }

      case 'google_gmail_send': {
        const to = args?.to as string
        const subject = args?.subject as string
        const body = args?.body as string
        const cc = args?.cc as string | undefined
        const bcc = args?.bcc as string | undefined
        const attachmentInputs = args?.attachments as Array<{ drive_file_id?: string; drive_url?: string; filename?: string }> | undefined

        if (!to || !subject || !body) {
          throw new Error('to, subject, and body are required')
        }

        let raw: string
        const attachedFiles: string[] = []

        if (attachmentInputs && attachmentInputs.length > 0) {
          const attachments: AttachmentData[] = []
          for (const att of attachmentInputs) {
            const fileId = att.drive_file_id || (att.drive_url ? extractDriveFileId(att.drive_url) : null)
            if (!fileId) throw new Error('各添付ファイルには drive_file_id または drive_url が必要です')
            const downloaded = await downloadDriveFile(fileId, userEmail, att.filename)
            attachments.push(downloaded)
            attachedFiles.push(downloaded.filename)
          }
          raw = encodeEmailWithAttachments(to, subject, body, attachments, resolvedUser, cc, bcc)
        } else {
          raw = encodeEmail(to, subject, body, resolvedUser, cc, bcc)
        }

        const response = await gmail.users.messages.send({
          userId,
          requestBody: { raw },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'メールを送信しました',
              id: response.data.id,
              スレッドID: response.data.threadId,
              宛先: to,
              件名: subject,
              ...(attachedFiles.length > 0 ? { 添付ファイル: attachedFiles } : {}),
            }, null, 2),
          }],
        }
      }

      case 'google_gmail_reply': {
        const messageId = args?.message_id as string
        const body = args?.body as string
        const cc = args?.cc as string | undefined
        const bcc = args?.bcc as string | undefined
        const replyAttachmentInputs = args?.attachments as Array<{ drive_file_id?: string; drive_url?: string; filename?: string }> | undefined

        if (!messageId || !body) {
          throw new Error('message_id and body are required')
        }

        // Get original message to extract headers
        const originalMessage = await gmail.users.messages.get({
          userId,
          id: messageId,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Message-ID', 'References'],
        })

        const headers = originalMessage.data.payload?.headers || []
        const originalFrom = getHeader(headers, 'From')
        const originalSubject = getHeader(headers, 'Subject')
        const originalMessageId = getHeader(headers, 'Message-ID')
        const originalReferences = getHeader(headers, 'References')
        const threadId = originalMessage.data.threadId

        const replySubject = originalSubject.startsWith('Re:')
          ? originalSubject
          : `Re: ${originalSubject}`

        const references = originalReferences
          ? `${originalReferences} ${originalMessageId}`
          : originalMessageId

        const toMatch = originalFrom.match(/<([^>]+)>/)
        const to = toMatch ? toMatch[1] : originalFrom

        let raw: string
        const replyAttachedFiles: string[] = []

        if (replyAttachmentInputs && replyAttachmentInputs.length > 0) {
          const attachments: AttachmentData[] = []
          for (const att of replyAttachmentInputs) {
            const fileId = att.drive_file_id || (att.drive_url ? extractDriveFileId(att.drive_url) : null)
            if (!fileId) throw new Error('各添付ファイルには drive_file_id または drive_url が必要です')
            const downloaded = await downloadDriveFile(fileId, userEmail, att.filename)
            attachments.push(downloaded)
            replyAttachedFiles.push(downloaded.filename)
          }
          raw = encodeEmailWithAttachments(to, replySubject, body, attachments, resolvedUser, cc, bcc, originalMessageId, references)
        } else {
          raw = encodeReplyEmail(to, replySubject, body, originalMessageId, references, resolvedUser, cc, bcc)
        }

        const response = await gmail.users.messages.send({
          userId,
          requestBody: {
            raw,
            threadId: threadId || undefined,
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: '返信を送信しました',
              id: response.data.id,
              スレッドID: response.data.threadId,
              宛先: to,
              件名: replySubject,
              返信元メッセージID: messageId,
              ...(replyAttachedFiles.length > 0 ? { 添付ファイル: replyAttachedFiles } : {}),
            }, null, 2),
          }],
        }
      }

      case 'google_gmail_list_labels': {
        const response = await gmail.users.labels.list({ userId })
        
        const labels = response.data.labels?.map((label) => ({
          id: label.id,
          名前: label.name,
          タイプ: label.type,
          メッセージ数: label.messagesTotal,
          未読数: label.messagesUnread,
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: labels.length, ラベル: labels }, null, 2) }],
        }
      }

      case 'google_gmail_modify_labels': {
        const messageId = args?.message_id as string
        const addLabels = args?.add_labels as string[] | undefined
        const removeLabels = args?.remove_labels as string[] | undefined
        
        if (!messageId) throw new Error('message_id is required')
        if (!addLabels && !removeLabels) throw new Error('add_labels or remove_labels is required')

        await gmail.users.messages.modify({
          userId,
          id: messageId,
          requestBody: {
            addLabelIds: addLabels,
            removeLabelIds: removeLabels,
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'ラベルを変更しました',
              message_id: messageId,
              追加したラベル: addLabels || [],
              削除したラベル: removeLabels || [],
            }, null, 2),
          }],
        }
      }

      case 'google_gmail_create_draft': {
        const to = args?.to as string
        const subject = args?.subject as string
        const body = args?.body as string
        const cc = args?.cc as string | undefined
        const bcc = args?.bcc as string | undefined
        const inReplyToMessageId = args?.in_reply_to_message_id as string | undefined
        const draftAttachmentInputs = args?.attachments as Array<{ drive_file_id?: string; drive_url?: string; filename?: string }> | undefined

        if (!to || !subject || !body) {
          throw new Error('to, subject, and body are required')
        }

        const draftAttachments: AttachmentData[] = []
        const draftAttachedFiles: string[] = []
        if (draftAttachmentInputs && draftAttachmentInputs.length > 0) {
          for (const att of draftAttachmentInputs) {
            const fileId = att.drive_file_id || (att.drive_url ? extractDriveFileId(att.drive_url) : null)
            if (!fileId) throw new Error('各添付ファイルには drive_file_id または drive_url が必要です')
            const downloaded = await downloadDriveFile(fileId, userEmail, att.filename)
            draftAttachments.push(downloaded)
            draftAttachedFiles.push(downloaded.filename)
          }
        }

        let raw: string
        let threadId: string | undefined

        if (inReplyToMessageId) {
          const origMsg = await gmail.users.messages.get({
            userId,
            id: inReplyToMessageId,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Message-ID', 'References'],
          })

          const origHeaders = origMsg.data.payload?.headers || []
          const origMessageId = getHeader(origHeaders, 'Message-ID')
          const origReferences = getHeader(origHeaders, 'References')
          threadId = origMsg.data.threadId || undefined

          const refs = origReferences
            ? `${origReferences} ${origMessageId}`
            : origMessageId

          if (draftAttachments.length > 0) {
            raw = encodeEmailWithAttachments(to, subject, body, draftAttachments, resolvedUser, cc, bcc, origMessageId, refs)
          } else {
            raw = encodeReplyEmail(to, subject, body, origMessageId, refs, resolvedUser, cc, bcc)
          }
        } else {
          if (draftAttachments.length > 0) {
            raw = encodeEmailWithAttachments(to, subject, body, draftAttachments, resolvedUser, cc, bcc)
          } else {
            raw = encodeEmail(to, subject, body, resolvedUser, cc, bcc)
          }
        }

        const draftResponse = await gmail.users.drafts.create({
          userId,
          requestBody: {
            message: {
              raw,
              threadId,
            },
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: '下書きを作成しました',
              下書きID: draftResponse.data.id,
              メッセージID: draftResponse.data.message?.id,
              スレッドID: draftResponse.data.message?.threadId,
              宛先: to,
              件名: subject,
              ...(draftAttachedFiles.length > 0 ? { 添付ファイル: draftAttachedFiles } : {}),
            }, null, 2),
          }],
        }
      }

      default:
        throw new Error(`Unknown gmail tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ エラー: error.message }, null, 2) }],
      isError: true,
    }
  }
}
