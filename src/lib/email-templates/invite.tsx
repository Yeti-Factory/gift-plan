import { IOS_INSTALL_STEPS } from "../installation-guide";
import * as React from "react";

import { Button, Heading, Link, Text } from "@react-email/components";
import { GiftPlanHtml, text, button, link, footer, h1 } from "./brand";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <GiftPlanHtml preview={`Vous avez été invité(e) à rejoindre ${siteName}`}>
    <Heading style={h1}>Vous avez été invité(e)</Heading>
    <Text style={text}>
      Vous avez été invité(e) à rejoindre{" "}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accepter l'invitation
    </Button>
    <Heading as="h2" style={{ ...h1, fontSize: "18px", marginTop: "24px" }}>
      Installer Gift-Plan sur iPhone / iPad
    </Heading>
    {IOS_INSTALL_STEPS.map((step, index) => (
      <Text key={step.title} style={text}>
        <strong>
          {index + 1}. {step.title}
        </strong>
        <br />
        {step.detail}
      </Text>
    ))}
    <Text style={text}>
      <Link href={`${siteUrl.replace(/\/$/, "")}/invite`} style={link}>
        Ouvrir le guide d’installation
      </Link>
      . L’installation est facultative.
    </Text>
    <Text style={{ ...footer, marginTop: "32px" }}>
      Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email en toute sécurité.
    </Text>
  </GiftPlanHtml>
);

export default InviteEmail;
