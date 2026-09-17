import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL environment variable is not set');

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck:     false,
      tls:                  redisUrl.startsWith('rediss://') ? {} : undefined,
      retryStrategy: (times: number) => {
        if (times > 5) {
          console.error('Redis: max retries reached');
          return null;
        }
        return Math.min(times * 500, 3000);
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNABORTED'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('ready',   () => console.log('✅ Redis ready'));
    redis.on('error',   (err) => console.error('Redis error:', err.message));
    redis.on('close',   () => console.log('Redis connection closed'));
  }

  return redis;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}