import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import cloudbase from "@cloudbase/js-sdk";
import type { BackendEnv, CloudBaseEnv, SupabaseEnv } from "@/lib/config/env";

export function normalizeCloudBaseSignedUploadUrl(fullSignedURL: string, token: string): string {
  const signedUrl = new URL(fullSignedURL);
  signedUrl.pathname = signedUrl.pathname.replace(
    "/v1/storages/v1/storages/",
    "/v1/storages/",
  );
  signedUrl.searchParams.set("token", token);
  return signedUrl.toString();
}

export function createSupabaseAdminClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function createCloudBaseAdminClient(env: CloudBaseEnv): SupabaseClient {
  const app = cloudbase.init({
    env: env.CLOUDBASE_ENV_ID,
    region: env.CLOUDBASE_REGION,
    accessKey: env.CLOUDBASE_APIKEY,
  });
  const database = app.rdb() as unknown as SupabaseClient;
  const storage = {
    from(bucket: string) {
      const client = app.storage.from(bucket);
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === "createSignedUrl") {
            return async (path: string, expiresIn: number) => {
              const result = await target.createSignedUrl(path, expiresIn);
              return result.data
                ? { ...result, data: { signedUrl: result.data.fullSignedURL } }
                : result;
            };
          }
          if (property === "createSignedUploadUrl") {
            return async (path: string) => {
              const result = await target.createSignedUploadUrl(path);
              if (!result.data) return result;
              return {
                ...result,
                data: {
                  ...result.data,
                  signedUrl: normalizeCloudBaseSignedUploadUrl(
                    result.data.fullSignedURL,
                    result.data.token,
                  ),
                },
              };
            };
          }
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
  return Object.assign(database, { storage }) as SupabaseClient;
}

export function createBackendAdminClient(env: BackendEnv): SupabaseClient {
  return env.provider === "cloudbase"
    ? createCloudBaseAdminClient(env.config)
    : createSupabaseAdminClient(env.config);
}
