import * as React from "react";

import { Button, Heading, Link, Text } from "@react-email/components";
import { GiftPlanHtml, text, button, link, footer, h1 } from "./brand";

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <GiftPlanHtml preview={`Confirmez votre changement d'email pour ${siteName}`}>
    <Heading style={h1}>Confirmez votre changement d'email</Heading>
    <Text style={text}>
      Vous avez demandé à changer votre adresse email pour {siteName} de{" "}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{" "}
      vers{" "}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Text style={text}>Cliquez sur le bouton ci-dessous pour confirmer ce changement :</Text>
    <Button style={button} href={confirmationUrl}>
      Confirmer le changement
    </Button>
    <Text style={{ ...footer, marginTop: "32px" }}>
      Si vous n'avez pas demandé ce changement, veuillez sécuriser votre compte immédiatement.
    </Text>
  </GiftPlanHtml>
);

export default EmailChangeEmail;
