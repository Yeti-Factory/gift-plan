import { Button, Heading, Text } from '@react-email/components'
import {
  GiftPlanHtml,
  h1,
  text,
  button,
  FooterNote,
} from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <GiftPlanHtml preview={`Réinitialisez votre mot de passe ${siteName}`}>
    <Heading style={h1}>Réinitialisez votre mot de passe</Heading>
    <Text style={text}>
      Nous avons reçu une demande de réinitialisation du mot de passe de votre compte {siteName}. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Réinitialiser mon mot de passe
    </Button>
    <Text style={text}>
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe ne sera pas modifié.
    </Text>
    <FooterNote siteName={siteName} />
  </GiftPlanHtml>
)

export default RecoveryEmail
