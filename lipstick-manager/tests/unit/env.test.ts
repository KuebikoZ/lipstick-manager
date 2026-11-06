import { describe, expect, it } from "vitest";
import { parseAuthEnv, parseBackendEnv, parseServerEnv, parseSupabaseEnv } from "../../lib/config/env";

const validEnvironment = {
  APP_URL: "https://example.vercel.app",
  AUTH_SECRET: "a".repeat(32),
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "$argon2id$valid-placeholder",
  SESSION_VERSION: "1",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "supabase-secret-key",
  SUPABASE_STORAGE_BUCKET: "lipstick-images",
  AI_PROVIDER: "deepseek",
  AI_MODEL: "deepseek-flash",
  AI_API_KEY: "deepseek-key",
  AI_MAX_COST_CNY: "2",
  AI_USD_CNY_RATE: "7.2",
  LOG_LEVEL: "info",
};

describe("parseServerEnv", () => {
  it("accepts the documented server environment", () => {
    const environment = parseServerEnv(validEnvironment);

    expect(environment.AI_PROVIDER).toBe("deepseek");
    expect(environment.AI_MAX_COST_CNY).toBe(2);
    expect(environment.SUPABASE_SECRET_KEY).toBe("supabase-secret-key");
  });

  it("rejects public secrets and unknown variables", () => {
    expect(() =>
      parseServerEnv({
        ...validEnvironment,
        NEXT_PUBLIC_AI_API_KEY: "must-not-be-public",
      }),
    ).toThrow();
  });

  it("rejects an AI task budget above two yuan", () => {
    expect(() =>
      parseServerEnv({
        ...validEnvironment,
        AI_MAX_COST_CNY: "2.01",
      }),
    ).toThrow();
  });

  it("ignores unrelated process variables", () => {
    expect(() =>
      parseServerEnv({
        ...validEnvironment,
        PATH: "/usr/bin",
      }),
    ).not.toThrow();
  });
});

describe("scoped server environment", () => {
  it("parses auth without requiring future AI configuration", () => {
    const environment = parseAuthEnv(validEnvironment);
    expect(environment.ADMIN_USERNAME).toBe("admin");
    expect(environment.SESSION_VERSION).toBe(1);
  });

  it("parses the server-only Supabase configuration independently", () => {
    const environment = parseSupabaseEnv(validEnvironment);
    expect(environment.SUPABASE_SECRET_KEY).toBe("supabase-secret-key");
  });

  it("uses the Shanghai CloudBase backend for public demo mode", () => {
    const environment = parseBackendEnv({
      APP_MODE: "public-demo",
      CLOUDBASE_ENV_ID: "lipstick-public-demo-test",
      CLOUDBASE_REGION: "ap-shanghai",
      CLOUDBASE_APIKEY: "server-only-key",
      CLOUDBASE_STORAGE_BUCKET: "lipstick-images",
    });
    expect(environment.provider).toBe("cloudbase");
    expect(environment.storageBucket).toBe("lipstick-images");
  });

  it("keeps Supabase as the default admin backend", () => {
    expect(parseBackendEnv(validEnvironment).provider).toBe("supabase");
  });
});
