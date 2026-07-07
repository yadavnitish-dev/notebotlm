import type { ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

function stripUrlHost(urlOrHost: string): string {
  return urlOrHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getRedisConnection(): ConnectionOptions | IORedis | null {
  if (process.env.REDIS_URL) {
    return new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return {
      host: stripUrlHost(process.env.UPSTASH_REDIS_REST_URL),
      port: 6379,
      password: process.env.UPSTASH_REDIS_REST_TOKEN,
      tls: {},
      maxRetriesPerRequest: null,
    };
  }

  if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
    return {
      host: stripUrlHost(process.env.REDIS_HOST),
      port: parseInt(process.env.REDIS_PORT, 10),
      ...(process.env.REDIS_PASSWORD
        ? { password: process.env.REDIS_PASSWORD }
        : {}),
      ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }

  return null;
}
