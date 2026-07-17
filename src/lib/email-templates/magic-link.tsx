import { Button, Heading, Text } from '@react-email/components'
import {
  GiftPlanHtml,
  h1,
  text,
  button,
  FooterNote,
} from './brand'

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
      Cliquez sur le bouton ci-dessous pour vous connecter à {siteName}. Ce lien expire rapidement.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Me connecter
    </Button>
    <Text style={text}>
      Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email en toute sécurité.
    </Text>
    <FooterNote siteName={siteName} />
  </GiftPlanHtml>
)

export default MagicLinkEmail
