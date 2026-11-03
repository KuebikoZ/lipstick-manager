import { parseServerEnv } from "../lib/config/env";

try {
  parseServerEnv(process.env);
  console.log("Environment variables are valid.");
} catch (error: unknown) {
  console.error("Environment validation failed.");

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
}
