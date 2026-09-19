import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface BetaAccessEmailProps {
  position: number;
}

export function BetaAccessEmail({ position = 1 }: BetaAccessEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`You're #${position} in line for Dev Drip beta access.`}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* logo */}
          <Text style={logo}>dev drip</Text>

          <Hr style={divider} />

          <Heading style={heading}>Request for Beta Access</Heading>

          <Text style={paragraph}>
            Hey, 
            thank you for showing interest in Dev Drip. That genuinely
            means a lot.
          </Text>

          <Section style={positionBox}>
            <Text style={positionLabel}>your position</Text>
            <Text style={positionNumber}>#{position}</Text>
          </Section>

          <Text style={paragraph}>
            We&apos;re onboarding developers in waves. When your wave opens, i&apos;ll
            personally reach out to you with setup instructions. No campaigns, no
            newsletters: just the access link when it&apos;s ready.
          </Text>

          <Text style={paragraph}>
            In the meantime, if you&apos;re curious about what we&apos;re building
            or just want to say hi, feel free to reach out on{" "}
            <Link href="https://www.linkedin.com/in/manurajput2911/" style={link}>
              LinkedIn
            </Link>
            .
          </Text>

          <Text style={signoff}>Manu</Text>

          <Hr style={divider} />

          <Text style={footer}>
            Dev Drip | earn while your agent thinks.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// email-safe styles — inline, no CSS variables
const body = {
  backgroundColor: "#F7F6F3",
  fontFamily:
    '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: "0",
  padding: "40px 0",
} as const;

const container = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #DDDDD8",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "520px",
  padding: "40px 32px",
} as const;

const logo = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "18px",
  fontWeight: "700" as const,
  color: "#0E0E11",
  margin: "0 0 16px 0",
  letterSpacing: "-0.02em",
};

const divider = {
  borderColor: "#DDDDD8",
  margin: "20px 0",
};

const heading = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "22px",
  fontWeight: "700" as const,
  color: "#0E0E11",
  margin: "0 0 20px 0",
  lineHeight: "1.3",
};

const paragraph = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#5C5C66",
  margin: "0 0 16px 0",
};

const link = {
  color: "#4F46E5",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const positionBox = {
  backgroundColor: "#F7F6F3",
  border: "1px solid #DDDDD8",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
  textAlign: "center" as const,
};

const positionLabel = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "10px",
  fontWeight: "600" as const,
  color: "#9C9CA5",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: "0 0 4px 0",
};

const positionNumber = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: "32px",
  fontWeight: "700" as const,
  color: "#0E0E11",
  margin: "0",
  lineHeight: "1.1",
};

const signoff = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#0E0E11",
  fontWeight: "500" as const,
  margin: "24px 0 0 0",
};

const footer = {
  fontSize: "12px",
  color: "#9C9CA5",
  textAlign: "center" as const,
  margin: "0",
};

export default BetaAccessEmail;
