import { Heading, Text } from '@react-email/components'
import {
  GiftPlanHtml,
  h1,
  text,
  codeBox,
  codeText,
  FooterNote,
} from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <GiftPlanHtml preview={`Votre code de vérification Gift-Plan`}>
    <Heading style={h1}>Votre code de vérification</Heading>
    <Text style={text}>
      Utilisez le code ci-dessous pour confirmer votre identité. Il expire rapidement.
    </Text>
    <Text style={codeBox}>
      <Text style={codeText}>{token}</Text>
    </Text>
    <Text style={text}>
      Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email en toute sécurité.
    </Text>
    <FooterNote siteName="Gift-Plan" />
  </GiftPlanHtml>
)

export default ReauthenticationEmail
