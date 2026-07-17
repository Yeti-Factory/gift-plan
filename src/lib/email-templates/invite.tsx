import { Button, Heading, Link, Text } from '@react-email/components'
import {
  GiftPlanHtml,
  h1,
  text,
  link,
  button,
  FooterNote,
} from './brand'

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
  <GiftPlanHtml preview={`Vous êtes invité à rejoindre ${siteName}`}>
    <Heading style={h1}>Vous avez été invité 🎉</Heading>
    <Text style={text}>
      Quelqu'un vous a invité à rejoindre{' '}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      , l'application collaborative pour créer et partager des listes de cadeaux sans gâcher la surprise.
    </Text>
    <Text style={text}>
      Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte :
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accepter l'invitation
    </Button>
    <Text style={text}>
      Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email en toute sécurité.
    </Text>
    <FooterNote siteName={siteName} />
  </GiftPlanHtml>
)

export default InviteEmail
