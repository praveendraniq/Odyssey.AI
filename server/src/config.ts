import 'dotenv/config';

const bool = (value: string | undefined, fallback: boolean) => value === undefined ? fallback : value === 'true';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mockMode: bool(process.env.MOCK_MODE, true),
  sabre: {
    authVersion: process.env.SABRE_AUTH_VERSION ?? 'v3',
    clientId: process.env.SABRE_CLIENT_ID,
    clientSecret: process.env.SABRE_CLIENT_SECRET,
    v2UserId: process.env.SABRE_V2_USER_ID,
    v2Password: process.env.SABRE_V2_PASSWORD,
    v2Pcc: process.env.SABRE_V2_PCC ?? 'S5OM',
    v2Domain: process.env.SABRE_V2_DOMAIN ?? 'EXT',
    baseUrl: process.env.SABRE_BASE_URL ?? 'https://api.cert.platform.sabre.com',
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    environment: process.env.PAYPAL_ENV ?? 'sandbox',
  },
  vocalBridge: {
    apiKey: process.env.VOCAL_BRIDGE_API_KEY,
    baseUrl: process.env.VOCAL_BRIDGE_API_URL ?? process.env.VOCAL_BRIDGE_BASE_URL,
    agentId: process.env.VOCAL_BRIDGE_AGENT_ID,
    outboundContextSecret: process.env.VOCAL_BRIDGE_CONTEXT_SECRET,
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
