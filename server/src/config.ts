import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Always load the server-owned environment file when present. The root dev
// command keeps the repository as process.cwd(), which previously caused
// dotenv to load the older root .env and silently miss server-only settings
// such as VOCAL_BRIDGE_AGENT_ID. Existing shell variables still take priority.
const serverEnvPath = fileURLToPath(new URL('../.env', import.meta.url));
const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
loadEnv({ path: existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath });

const bool = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : value === 'true';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mockMode: bool(process.env.MOCK_MODE, true),
  sabre: {
    authVersion: process.env.SABRE_AUTH_VERSION ?? 'v3',
    clientId: process.env.SABRE_CLIENT_ID,
    clientSecret: process.env.SABRE_CLIENT_SECRET,
    v2UserId: process.env.SABRE_V2_USER_ID ?? process.env.SABRE_EPR_USERNAME,
    v2Password: process.env.SABRE_V2_PASSWORD ?? process.env.SABRE_EPR_PASSWORD,
    v2Pcc: process.env.SABRE_V2_PCC ?? 'S5OM',
    v2Domain: process.env.SABRE_V2_DOMAIN ?? 'EXT',
    baseUrl: process.env.SABRE_BASE_URL ?? 'https://api.cert.platform.sabre.com',
    accessToken: process.env.SABRE_ACCESS_TOKEN,
    mcpUrl: process.env.SABRE_MCP_URL ?? 'https://mcp2.cert.sabre.com/mcp',
    pcc: process.env.SABRE_PCC ?? 'S5OM',
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    environment: process.env.PAYPAL_ENV ?? 'sandbox',
  },
  vocalBridge: {
    apiKey: process.env.VOCAL_BRIDGE_API_KEY,
    mayaApiKey: process.env.VOCAL_BRIDGE_MAYA_API_KEY,
    baseUrl: process.env.VOCAL_BRIDGE_API_URL ?? process.env.VOCAL_BRIDGE_BASE_URL,
    agentId: process.env.VOCAL_BRIDGE_AGENT_ID,
    mayaAgentId: process.env.VOCAL_BRIDGE_MAYA_AGENT_ID ?? '8461e8c8-6b94-42c7-bc4b-dbe48d25e700',
    mayaPhone: process.env.VOCAL_BRIDGE_MAYA_PHONE ?? '+12403781801',
    // Prefer the documented outbound callback secret name. Keep the original
    // alias so existing local setups continue to work during the hackathon.
    outboundContextSecret: process.env.VOCAL_BRIDGE_OUTBOUND_CONTEXT_SECRET ?? process.env.VOCAL_BRIDGE_CONTEXT_SECRET,
  },
  landingAi: {
    apiKey: process.env.LANDING_AI_API_KEY,
    endpoint: process.env.LANDING_AI_ENDPOINT,
  },
  googlePlaces: {
    apiKey: process.env.GOOGLE_PLACES_API_KEY,
  },
  googleWeather: {
    apiKey: process.env.GOOGLE_WEATHER_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY,
  },
};
