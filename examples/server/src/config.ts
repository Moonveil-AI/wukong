import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load environment variables
loadEnv();

const envSchema = z.object({
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  PORT: z.string().transform(Number).default('3000'),
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  HOST: z.string().default('localhost'),
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  DATABASE_PATH: z.string().default('./data/wukong.db'),
  // API Keys - optional but warned if missing
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  OPENAI_API_KEY: z.string().optional(),
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  ANTHROPIC_API_KEY: z.string().optional(),
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  GEMINI_API_KEY: z.string().optional(),
  // Auth
  // biome-ignore lint/style/useNamingConvention: Environment variables are uppercase
  API_AUTH_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

export const config = {
  server: {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
  },
  logging: {
    level: env.LOG_LEVEL,
    format: env.NODE_ENV === 'production' ? 'json' : 'text',
  },
  database: {
    path: env.DATABASE_PATH,
  },
  auth: {
    enabled: !!env.API_AUTH_KEY,
    key: env.API_AUTH_KEY,
  },
  llm: {
    openaiKey: env.OPENAI_API_KEY,
    anthropicKey: env.ANTHROPIC_API_KEY,
    geminiKey: env.GEMINI_API_KEY,
  },
};
