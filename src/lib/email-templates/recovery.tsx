import * as React from 'react'

import { Button, Heading, Text } from '@react-email/components'
import { GiftPlanHtml, text, button, footer, h1 } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <GiftPlanHtml preview={`Réinitialisez votre mot de passe pour ${siteName}`}>
    <Heading style={h1}>Réinitialisez votre mot de passe</Heading>
    <Text style={text}>
      Nous avons reçu une demande de réinitialisation de votre mot de passe pour {siteName}. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Réinitialiser le mot de passe
    </Button>
    <Text style={{ ...footer, marginTop: '32px' }}>
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe ne sera pas modifié.
    </Text>
  </GiftPlanHtml>
)

export default RecoveryEmail
