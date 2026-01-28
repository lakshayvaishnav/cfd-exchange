import { prisma } from "@repo/database";
import { redis } from "@repo/redis";

async function getBalance(id: string) {
  const userAssets = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      assets: {
        select: {
          symbol: true,
          balance: true,
          decimals: true,
        },
      },
    },
  });
  return userAssets?.assets || [];
}

const addToStream = async (id: string, request: any) => {
  console.log(
    `[CONTROLLER] Adding order ${id} to engine-stream:`,
    JSON.stringify(request, null, 2),
  );

  await redis.xadd(
    "engine-stream",
    "*",
    "data",
    JSON.stringify({
      id,
      request,
    }),
  );

  console.log(`[CONTROLLER] Successfully added order ${id} to engine-stream`);
};

const subsciber = 