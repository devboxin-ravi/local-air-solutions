/**
 * Application configuration — the ONLY module that reads import.meta.env.
 */

import { z } from 'zod';

const EnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8000/api/v1'),
  VITE_ASSET_BASE_URL: z.string().url().default('http://localhost:8000'),
  VITE_APP_NAME: z.string().default('Local Air Solutions'),
  VITE_APP_VERSION: z.string().default('1.0.0'),
  VITE_GOOGLE_MAPS_KEY: z.string().optional().default(''),
});

const env = EnvSchema.parse(import.meta.env);

export interface AppConfig {
  apiBaseUrl: string;
  assetBaseUrl: string;
  appName: string;
  appVersion: string;
  googleMapsKey: string;
  isDev: boolean;
}

export const config: AppConfig = {
  apiBaseUrl: env.VITE_API_BASE_URL,
  assetBaseUrl: env.VITE_ASSET_BASE_URL,
  appName: env.VITE_APP_NAME,
  appVersion: env.VITE_APP_VERSION,
  googleMapsKey: env.VITE_GOOGLE_MAPS_KEY,
  isDev: import.meta.env.DEV,
};
