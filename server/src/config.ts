import 'dotenv/config';

const bool = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : value === 'true';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mockMode: bool(process.env.MOCK_MODE, true),
  sabre: {
    clientId: process.env.SABRE_CLIENT_ID,
    clientSecret: process.env.SABRE_CLIENT_SECRET,
    baseUrl: process.env.SABRE_BASE_URL ?? 'https://api.cert.platform.sabre.com',
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
