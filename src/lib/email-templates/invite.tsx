import * as React from 'react'

import { Button, Heading, Link, Text } from '@react-email/components'
import { GiftPlanHtml, text, button, link, footer, h1 } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <GiftPlanHtml preview={`Vous avez été invité(e) à rejoindre ${siteName}`}>
    <Heading style={h1}>Vous avez été invité(e)</Heading>
    <Text style={text}>
      Vous avez été invité(e) à rejoindre{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accepter l'invitation
    </Button>
    <Text style={{ ...footer, marginTop: '32px' }}>
      Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email en toute sécurité.
    </Text>
  </GiftPlanHtml>
)

export default InviteEmail
