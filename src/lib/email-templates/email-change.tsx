import { Button, Heading, Link, Text } from '@react-email/components'
import {
  GiftPlanHtml,
  h1,
  text,
  link,
  button,
  FooterNote,
} from './brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <GiftPlanHtml preview={`Confirmez votre nouvelle adresse email sur ${siteName}`}>
    <Heading style={h1}>Confirmez votre nouvelle adresse email</Heading>
    <Text style={text}>
      Vous avez demandé à changer l'adresse email de votre compte {siteName} de{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{' '}
      vers{' '}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Text style={text}>Cliquez sur le bouton ci-dessous pour confirmer ce changement :</Text>
    <Button style={button} href={confirmationUrl}>
      Confirmer le changement
    </Button>
    <Text style={text}>
      Si vous n'avez pas demandé ce changement, sécurisez immédiatement votre compte.
    </Text>
    <FooterNote siteName={siteName} />
  </GiftPlanHtml>
)

export default EmailChangeEmail
