import { hash } from "@node-rs/argon2";

const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 12) {
  console.error("ADMIN_PASSWORD must contain at least 12 characters.");
  process.exit(1);
}

const passwordHash = await hash(password, {
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
});

process.stdout.write(`${passwordHash}\n`);
