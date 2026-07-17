import * as React from 'react'
import {
  createAuthEmailHandler,
  type AuthEmailActionType,
  type AuthEmailDefinitions,
  type AuthEmailHookData,
} from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "Gift-Plan"
const SENDER_DOMAIN = "yeti-lab.fr"
const FROM_DOMAIN = "yeti-lab.fr"
const SITE_URL = "https://gift-plan.yeti-lab.fr"
const RESET_PASSWORD_URL = `${SITE_URL}/reset-password`
const ALLOWED_RECOVERY_REDIRECT_ORIGINS = new Set([
  SITE_URL,
  'https://gift-plan.lovable.app',
  'https://id-preview--96df8292-ee19-43bf-af6b-a257a4d04dfb.lovable.app',
  'https://96df8292-ee19-43bf-af6b-a257a4d04dfb.lovableproject.com',
])

const authEmails = {
  signup: {
    subject: 'Confirmez votre adresse email',
    render: (data) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        recipient: data.email,
        confirmationUrl: data.url,
      }),
  },
  invite: {
    subject: "Vous avez été invité(e) à rejoindre Gift-Plan",
    render: (data) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: data.url,
      }),
  },
  magiclink: {
    subject: 'Votre lien de connexion Gift-Plan',
    render: (data) =>
      React.createElement(MagicLinkEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  recovery: {
    subject: 'Réinitialisez votre mot de passe Gift-Plan',
    render: (data) =>
      React.createElement(RecoveryEmail, {
        siteName: SITE_NAME,
        confirmationUrl: forceRecoveryRedirectUrl(data.url),
      }),
  },
  email_change: {
    subject: 'Confirmez votre nouvelle adresse email',
    render: (data) =>
      React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: data.old_email ?? '',
        newEmail: data.new_email ?? '',
        confirmationUrl: data.url,
      }),
  },
  reauthentication: {
    subject: 'Votre code de vérification Gift-Plan',
    render: (data) => React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
  },
} satisfies AuthEmailDefinitions

function forceRecoveryRedirectUrl(value: string) {
  try {
    const url = new URL(value)
    url.searchParams.delete('redirect_uri')
    url.searchParams.set('redirect_to', RESET_PASSWORD_URL)
    return url.toString()
  } catch {
    return value
  }
}

function isAuthActionType(value: string): value is AuthEmailActionType {
  return value in authEmails
}

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false

    const redirectTo = url.searchParams.get('redirect_to') ?? url.searchParams.get('redirect_uri')
    if (!redirectTo) return true

    const redirectUrl = new URL(redirectTo)
    return redirectUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function isExpectedRecoveryUrl(value: string) {
  try {
    const url = new URL(value)
    const backendUrl = process.env.SUPABASE_URL
    if (backendUrl && url.origin !== new URL(backendUrl).origin) return false

    const type = url.searchParams.get('type')
    if (type && type !== 'recovery') return false

    const redirectTo = url.searchParams.get('redirect_to') ?? url.searchParams.get('redirect_uri')
    if (!redirectTo) return true

    return ALLOWED_RECOVERY_REDIRECT_ORIGINS.has(new URL(redirectTo).origin)
  } catch {
    return false
  }
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY_GIFT_PLAN || process.env.RESEND_API_KEY || null
}

function parseAuthPayload(body: unknown): { run_id?: string; data: AuthEmailHookData; version?: string } | null {
  if (!body || typeof body !== 'object') return null
  const payload = body as { run_id?: unknown; version?: unknown; type?: unknown; data?: unknown }
  const data = payload.data as Partial<AuthEmailHookData> | undefined

  if (
    payload.type !== 'auth' ||
    !data ||
    typeof data.action_type !== 'string' ||
    !isAuthActionType(data.action_type) ||
    typeof data.email !== 'string' ||
    typeof data.url !== 'string' ||
    !isSafeHttpsUrl(data.url)
  ) {
    return null
  }

  return {
    run_id: typeof payload.run_id === 'string' ? payload.run_id : undefined,
    version: typeof payload.version === 'string' ? payload.version : undefined,
    data: {
      action_type: data.action_type,
      url: data.url,
      email: data.email,
      old_email: typeof data.old_email === 'string' ? data.old_email : null,
      new_email: typeof data.new_email === 'string' ? data.new_email : null,
      site_url: typeof data.site_url === 'string' ? data.site_url : SITE_URL,
      token: typeof data.token === 'string' ? data.token : null,
      new_token: typeof data.new_token === 'string' ? data.new_token : null,
      callback_url: typeof data.callback_url === 'string' ? data.callback_url : undefined,
    },
  }
}

async function sendAuthEmailWithResend(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } })
  }

  const resendKey = getResendApiKey()
  if (!resendKey) {
    console.error('[auth-email] Neither RESEND_API_KEY_GIFT_PLAN nor RESEND_API_KEY is configured')
    return Response.json({ error: 'Email sender is not configured for this deployment' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = parseAuthPayload(body)
  if (!event) {
    return Response.json({ error: 'Invalid auth email webhook payload' }, { status: 400 })
  }
  if (event.version && event.version !== '1') {
    return Response.json({ error: `Unsupported payload version: ${event.version}` }, { status: 400 })
  }
  if (event.data.action_type !== 'recovery' || !isExpectedRecoveryUrl(event.data.url)) {
    console.error('[auth-email] Unsupported recovery URL', {
      action_type: event.data.action_type,
      has_url: Boolean(event.data.url),
    })
    return Response.json({ error: 'Unsupported auth email action' }, { status: 400 })
  }

  const definition = authEmails[event.data.action_type]
  const { render } = await import('@react-email/render')
  const subject = definition.subject
  const element = await definition.render(event.data)
  const html = await render(element)
  const text = await render(element, { plainText: true })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      ...(event.run_id ? { 'Idempotency-Key': event.run_id } : {}),
    },
    body: JSON.stringify({
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      to: [event.data.email],
      subject,
      html,
      text,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[auth-email] Resend failed', response.status, errorText)
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return Response.json({ success: true, sent: true })
}

function createConfiguredHandler() {
  const apiKey = process.env.LOVABLE_API_KEY

  if (!apiKey) {
    return null
  }

  // The SDK handler owns verification, dispatch, and retry semantics; this file
  // owns only the email decisions: subjects, templates, and per-type props.
  return createAuthEmailHandler({
    apiKey,
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    senderDomain: SENDER_DOMAIN,
    sendUrl: process.env.LOVABLE_SEND_URL,
    emails: authEmails,
  })
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        if (getResendApiKey()) {
          return sendAuthEmailWithResend(request)
        }

        const handler = createConfiguredHandler()

        if (!handler) {
          return sendAuthEmailWithResend(request)
        }

        return handler(request)
      },
    },
  },
})
