import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'
import { GiftPlanHtml, text, button, footer, h1 } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <GiftPlanHtml preview={`Votre lien de connexion pour ${siteName}`}>
    <Heading style={h1}>Votre lien de connexion</Heading>
    <Text style={text}>
      Cliquez sur le bouton ci-dessous pour vous connecter à {siteName}. Ce lien expirera sous peu.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Se connecter
    </Button>
    <Text style={{ ...footer, marginTop: '32px' }}>
      Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email en toute sécurité.
    </Text>
  </GiftPlanHtml>
)

export default MagicLinkEmail
