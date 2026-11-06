import { z } from "zod";

const authEnvShape = {
    APP_URL: z.url(),
    AUTH_SECRET: z.string().min(32),
    ADMIN_USERNAME: z.string().trim().min(1),
    ADMIN_PASSWORD_HASH: z.string().startsWith("$argon2"),
    SESSION_VERSION: z.coerce.number().int().positive(),
} as const;

const supabaseEnvShape = {
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SUPABASE_STORAGE_BUCKET: z.string().trim().min(1),
} as const;

const cloudBaseEnvShape = {
    CLOUDBASE_ENV_ID: z.string().trim().min(1),
    CLOUDBASE_REGION: z.literal("ap-shanghai").default("ap-shanghai"),
    CLOUDBASE_APIKEY: z.string().min(1),
    CLOUDBASE_STORAGE_BUCKET: z.string().trim().min(1),
} as const;

const aiEnvShape = {
    AI_PROVIDER: z.literal("deepseek"),
    AI_MODEL: z.literal("deepseek-flash"),
    AI_API_KEY: z.string().min(1),
    AI_MAX_COST_CNY: z.coerce.number().positive().max(2),
    AI_USD_CNY_RATE: z.coerce.number().positive(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
} as const;

const authEnvSchema = z.object(authEnvShape).strict();
const supabaseEnvSchema = z.object(supabaseEnvShape).strict();
const serverEnvSchema = z
  .object({ ...authEnvShape, ...supabaseEnvShape, ...aiEnvShape })
  .strict();

export type AuthEnv = z.infer<typeof authEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
const cloudBaseEnvSchema = z.object(cloudBaseEnvShape).strict();
export type CloudBaseEnv = z.infer<typeof cloudBaseEnvSchema>;
export type BackendEnv =
  | { provider: "supabase"; storageBucket: string; config: SupabaseEnv }
  | { provider: "cloudbase"; storageBucket: string; config: CloudBaseEnv };
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const serverEnvKeys = Object.keys(serverEnvSchema.shape);

function isPublicSecret(key: string): boolean {
  return key.startsWith("NEXT_PUBLIC_") && /(KEY|SECRET|PASSWORD_HASH)$/.test(key);
}

export function parseServerEnv(
  environment: Record<string, string | undefined>,
): ServerEnv {
  const publicSecret = Object.keys(environment).find(isPublicSecret);

  if (publicSecret) {
    throw new Error(`Sensitive environment variable must not be public: ${publicSecret}`);
  }

  const configuredEnvironment = Object.fromEntries(
    serverEnvKeys.map((key) => [key, environment[key]]),
  );

  return serverEnvSchema.parse(configuredEnvironment);
}

function parseSelectedEnv<T>(
  schema: z.ZodObject<z.ZodRawShape>,
  environment: Record<string, string | undefined>,
): T {
  const publicSecret = Object.keys(environment).find(isPublicSecret);

  if (publicSecret) {
    throw new Error(`Sensitive environment variable must not be public: ${publicSecret}`);
  }

  const configuredEnvironment = Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, environment[key]]),
  );

  return schema.parse(configuredEnvironment) as T;
}

export function parseAuthEnv(
  environment: Record<string, string | undefined>,
): AuthEnv {
  return parseSelectedEnv<AuthEnv>(authEnvSchema, environment);
}

export function parseSupabaseEnv(
  environment: Record<string, string | undefined>,
): SupabaseEnv {
  return parseSelectedEnv<SupabaseEnv>(supabaseEnvSchema, environment);
}

export function parseBackendEnv(
  environment: Record<string, string | undefined>,
): BackendEnv {
  if (environment.APP_MODE === "public-demo") {
    const config = parseSelectedEnv<CloudBaseEnv>(cloudBaseEnvSchema, environment);
    return {
      provider: "cloudbase",
      storageBucket: config.CLOUDBASE_STORAGE_BUCKET,
      config,
    };
  }
  const config = parseSupabaseEnv(environment);
  return {
    provider: "supabase",
    storageBucket: config.SUPABASE_STORAGE_BUCKET,
    config,
  };
}

const aiEnvSchema = z.object(aiEnvShape).strict();
export type AIEnv = z.infer<typeof aiEnvSchema>;
export function parseAIEnv(environment: Record<string, string | undefined>): AIEnv {
  return parseSelectedEnv<AIEnv>(aiEnvSchema, environment);
}
