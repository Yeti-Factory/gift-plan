import * as React from "react";

import { Button, Heading, Link, Text } from "@react-email/components";
import { GiftPlanHtml, BRAND, text, button, link, footer, h1 } from "./brand";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <GiftPlanHtml preview={`Confirmez votre adresse email pour ${siteName}`}>
    <Heading style={h1}>Confirmez votre email</Heading>
    <Text style={text}>
      Merci de votre inscription sur{" "}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>{" "}
      !
    </Text>
    <Text style={text}>
      Veuillez confirmer votre adresse email (
      <Link href={`mailto:${recipient}`} style={link}>
        {recipient}
      </Link>
      ) en cliquant sur le bouton ci-dessous :
    </Text>
    <Button style={button} href={confirmationUrl}>
      Vérifier mon email
    </Button>
    <Text style={{ ...footer, marginTop: "32px" }}>
      Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
    </Text>
  </GiftPlanHtml>
);

export default SignupEmail;
