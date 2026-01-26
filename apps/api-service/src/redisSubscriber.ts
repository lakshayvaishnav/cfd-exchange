import Redis from "ioredis";
export const CALLBACK_QUEUE = "callback-queue";

export class RedisSubscriber {
  private client: Redis;
  private callbacks: Record<string, (data: Record<string, string>) => void>;

  constructor() {
    const host = process.env.REDIS_HOST || "localhost";
    const port = Number(process.env.REDIS_PORT || 6379);
    this.client = new Redis({ host, port });
    // run loop
  }

  async runLoop() {
    while (true) {
      try {
        const response = await this.client.xread(
          "BLOCK",
          0,
          "STREAMS",
          CALLBACK_QUEUE,
          "$",
        );
        if (!response || response.length === 0) continue;

        const [, messages] = response[0]!;

        if (!messages || messages.length === 0) continue;

        for (const [id, rawfields] of messages) {
          const fields = rawfields as string[];

          const data: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]!] = fields[i + 1]!;

            const callback = data.id;
            console.log(`[SUBSCRIBER] Received callback`, data);
            // complete this logic
          }
        }
      } catch (error) {}
    }
  }
}
