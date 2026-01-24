import Redis from "ioredis";
const host = process.env.REDS_HOST || "localhost";
const port = Number(process.env.REDIS_PORT || 6379);
export const redis = new Redis({ host, port });
