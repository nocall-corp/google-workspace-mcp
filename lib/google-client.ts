import { google } from 'googleapis'
import type { calendar_v3, gmail_v1, drive_v3, tasks_v1 } from 'googleapis'

const ALLOWED_DOMAIN = process.env.GOOGLE_ALLOWED_DOMAIN || 'nocall.ai'
const DEFAULT_USER = process.env.GOOGLE_DEFAULT_USER || process.env.GOOGLE_DELEGATED_USER || 'hayashi@nocall.ai'

// Service account key from environment variable (JSON string)
function getServiceAccountKey(): object {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set')
  }
  try {
    return JSON.parse(keyJson)
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON')
  }
}

// Validate and resolve user email
export function resolveUserEmail(userEmail?: string): string {
  if (!userEmail) {
    return DEFAULT_USER
  }
  const domain = userEmail.split('@')[1]
  if (!domain || domain !== ALLOWED_DOMAIN) {
    throw new Error(`user_email must be a @${ALLOWED_DOMAIN} address. Got: ${userEmail}`)
  }
  return userEmail
}

// Create authenticated Google Auth client with domain-wide delegation
function createAuthClient(scopes: string[], userEmail: string) {
  const key = getServiceAccountKey()

  console.log(`[google-workspace-mcp] Accessing Google APIs as: ${userEmail}`)

  const auth = new google.auth.JWT({
    email: (key as any).client_email,
    key: (key as any).private_key,
    scopes,
    subject: userEmail, // Impersonate this user
  })

  return auth
}

// Calendar API client
export function getCalendarClient(): calendar_v3.Calendar {
  const auth = createAuthClient(['https://www.googleapis.com/auth/calendar'], DEFAULT_USER)
  return google.calendar({ version: 'v3', auth })
}

// Calendar API client for a specific user
export function getCalendarClientForUser(userEmail?: string): calendar_v3.Calendar {
  const resolvedUser = resolveUserEmail(userEmail)
  const auth = createAuthClient(['https://www.googleapis.com/auth/calendar'], resolvedUser)
  return google.calendar({ version: 'v3', auth })
}

// Gmail API client
export function getGmailClient(): gmail_v1.Gmail {
  const auth = createAuthClient([
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ], DEFAULT_USER)
  return google.gmail({ version: 'v1', auth })
}

// Gmail API client for a specific user
export function getGmailClientForUser(userEmail?: string): gmail_v1.Gmail {
  const resolvedUser = resolveUserEmail(userEmail)
  const auth = createAuthClient([
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ], resolvedUser)
  return google.gmail({ version: 'v1', auth })
}

// Drive API client (read-only)
export function getDriveClient(): drive_v3.Drive {
  const auth = createAuthClient(['https://www.googleapis.com/auth/drive.readonly'], DEFAULT_USER)
  return google.drive({ version: 'v3', auth })
}

// Drive API client (read-only) for a specific user
export function getDriveClientForUser(userEmail?: string): drive_v3.Drive {
  const resolvedUser = resolveUserEmail(userEmail)
  const auth = createAuthClient(['https://www.googleapis.com/auth/drive.readonly'], resolvedUser)
  return google.drive({ version: 'v3', auth })
}

// Drive API client (read-write, for uploads)
export function getDriveWriteClient(): drive_v3.Drive {
  const auth = createAuthClient(['https://www.googleapis.com/auth/drive'], DEFAULT_USER)
  return google.drive({ version: 'v3', auth })
}

// Drive API client (read-write) for a specific user
export function getDriveWriteClientForUser(userEmail?: string): drive_v3.Drive {
  const resolvedUser = resolveUserEmail(userEmail)
  const auth = createAuthClient(['https://www.googleapis.com/auth/drive'], resolvedUser)
  return google.drive({ version: 'v3', auth })
}

// Tasks API client
export function getTasksClient(): tasks_v1.Tasks {
  const auth = createAuthClient(['https://www.googleapis.com/auth/tasks'], DEFAULT_USER)
  return google.tasks({ version: 'v1', auth })
}

// Get delegated user for API calls that need it
export function getImpersonatedUser(userEmail?: string): string {
  return resolveUserEmail(userEmail)
}
