import * as React from 'react'
import { Body, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components'

export const BRAND = {
  name: 'Gift-Plan',
  tagline: 'Listes de cadeaux partagées',
  coral: '#ef5a6f',
  cream: '#fffbf5',
  creamDark: '#f7f0e6',
  gold: '#f3b13c',
  dark: '#3a2e2e',
  muted: '#7a6e6e',
  lightText: '#55575d',
}

export const main = {
  backgroundColor: BRAND.cream,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

export const container = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '32px',
  margin: '24px auto',
  maxWidth: '480px',
  boxShadow: '0 4px 24px rgba(58, 46, 46, 0.06)',
}

export const header = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

export const logo = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: BRAND.coral,
  margin: '0 0 4px',
}

export const tagline = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '0',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: BRAND.dark,
  margin: '0 0 20px',
  textAlign: 'center' as const,
}

export const text = {
  fontSize: '15px',
  color: BRAND.lightText,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = { color: BRAND.coral, textDecoration: 'underline' }

export const button = {
  backgroundColor: BRAND.coral,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const footer = {
  fontSize: '12px',
  color: BRAND.muted,
  margin: '32px 0 0',
  textAlign: 'center' as const,
}

export const codeBox = {
  backgroundColor: BRAND.creamDark,
  borderRadius: '12px',
  padding: '16px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}

export const codeText = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: BRAND.dark,
  letterSpacing: '2px',
  margin: '0',
}

export const divider = {
  borderTop: `1px solid ${BRAND.creamDark}`,
  margin: '24px 0',
}

export function LogoHeader() {
  return (
    <Section style={header}>
      <Text style={logo}>🎁 {BRAND.name}</Text>
      <Text style={tagline}>{BRAND.tagline}</Text>
    </Section>
  )
}

export function GiftPlanHtml({
  children,
  preview,
}: {
  children: React.ReactNode
  preview: string
}) {
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <LogoHeader />
          {children}
        </Container>
      </Body>
    </Html>
  )
}

export function FooterNote({ siteName }: { siteName: string }) {
  return (
    <Text style={footer}>
      © {new Date().getFullYear()} {siteName} —{' '}
      <Link href="https://gift-plan.yeti-lab.fr" style={link}>
        gift-plan.yeti-lab.fr
      </Link>
    </Text>
  )
}
