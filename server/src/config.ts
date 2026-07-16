import 'dotenv/config';

const bool = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : value === 'true';
const sabrePcc = (process.env.SABRE_PCC ?? 'S5OM').toUpperCase();
const sabreOauthVersion = process.env.SABRE_OAUTH_VERSION ?? 'v2';

if (sabrePcc === 'S50M') throw new Error('Invalid Sabre hackathon PCC S50M. Use S5OM with the uppercase letter O.');
if (!/^[A-Z0-9]{4}$/.test(sabrePcc)) throw new Error('SABRE_PCC must be a four-character uppercase Sabre PCC.');
if (sabreOauthVersion !== 'v2' && sabreOauthVersion !== 'v3') throw new Error('SABRE_OAUTH_VERSION must be v2 or v3.');

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mockMode: bool(process.env.MOCK_MODE, true),
  sabre: {
    // OAuth v2 uses the Developer Hub EPR User ID and its Password.
    // CLIENT_* aliases are retained for existing local .env files.
    eprUsername: process.env.SABRE_EPR_USERNAME ?? process.env.SABRE_CLIENT_ID,
    eprPassword: process.env.SABRE_EPR_PASSWORD ?? process.env.SABRE_CLIENT_SECRET,
    baseUrl: process.env.SABRE_BASE_URL ?? 'https://api.cert.platform.sabre.com',
    pcc: sabrePcc,
    oauthVersion: sabreOauthVersion,
    accessToken: process.env.SABRE_ACCESS_TOKEN,
    mcpUrl: process.env.SABRE_MCP_URL ?? 'https://mcp2.cert.sabre.com/mcp',
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    environment: process.env.PAYPAL_ENV ?? 'sandbox',
  },
  vocalBridge: {
    apiKey: process.env.VOCAL_BRIDGE_API_KEY,
    apiUrl: process.env.VOCAL_BRIDGE_API_URL ?? process.env.VOCAL_BRIDGE_BASE_URL ?? 'https://vocalbridgeai.com',
    agentId: process.env.VOCAL_BRIDGE_AGENT_ID,
  },
  landingAi: {
    apiKey: process.env.LANDING_AI_API_KEY,
    endpoint: process.env.LANDING_AI_ENDPOINT,
  },
};
