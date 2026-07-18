import * as React from "react";

import { Heading, Text } from "@react-email/components";
import { GiftPlanHtml, codeBox, codeText, text, footer, h1 } from "./brand";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <GiftPlanHtml preview="Votre code de vérification Gift-Plan">
    <Heading style={h1}>Confirmez votre identité</Heading>
    <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité :</Text>
    <Text style={codeBox}>
      <span style={codeText}>{token}</span>
    </Text>
    <Text style={{ ...footer, marginTop: "32px" }}>
      Ce code expirera sous peu. Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email
      en toute sécurité.
    </Text>
  </GiftPlanHtml>
);

export default ReauthenticationEmail;
