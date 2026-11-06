export type AppMode = "admin" | "public-demo";

export function appMode(environment: Readonly<Record<string, string | undefined>>): AppMode {
  return environment.APP_MODE === "public-demo" ? "public-demo" : "admin";
}

export function isPublicDemoMode(environment: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return appMode(environment) === "public-demo";
}
