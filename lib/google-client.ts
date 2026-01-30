import { google } from 'googleapis'
import type { calendar_v3, gmail_v1, drive_v3, tasks_v1 } from 'googleapis'

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

// Get the delegated user email
function getDelegatedUser(): string {
  const user = process.env.GOOGLE_DELEGATED_USER
  if (!user) {
    throw new Error('GOOGLE_DELEGATED_USER environment variable is not set')
  }
  return user
}

// Create authenticated Google Auth client with domain-wide delegation
function createAuthClient(scopes: string[]) {
  const key = getServiceAccountKey()
  const delegatedUser = getDelegatedUser()
  
  const auth = new google.auth.JWT({
    email: (key as any).client_email,
    key: (key as any).private_key,
    scopes,
    subject: delegatedUser, // Impersonate this user
  })
  
  return auth
}

// Calendar API client
export function getCalendarClient(): calendar_v3.Calendar {
  const auth = createAuthClient(['https://www.googleapis.com/auth/calendar'])
  return google.calendar({ version: 'v3', auth })
}

// Gmail API client
export function getGmailClient(): gmail_v1.Gmail {
  const auth = createAuthClient([
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ])
  return google.gmail({ version: 'v1', auth })
}

// Drive API client
export function getDriveClient(): drive_v3.Drive {
  const auth = createAuthClient(['https://www.googleapis.com/auth/drive.readonly'])
  return google.drive({ version: 'v3', auth })
}

// Tasks API client
export function getTasksClient(): tasks_v1.Tasks {
  const auth = createAuthClient(['https://www.googleapis.com/auth/tasks'])
  return google.tasks({ version: 'v1', auth })
}

// Get delegated user for API calls that need it
export function getImpersonatedUser(): string {
  return getDelegatedUser()
}
