import "dotenv/config";
import path from "path";
import type { PrismaConfig } from "prisma";
import { env } from "prisma/config";

export default {
  schema: path.join('prisma'),
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
} satisfies PrismaConfig;
