import "dotenv/config";
import path from "path";
import type { PrismaConfig } from "prisma";
import { env } from "prisma/config";

import { findDirectDatabaseUrl } from "./src/utils/dbconfig";

export default {
  schema: path.join('prisma'),
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: findDirectDatabaseUrl(),
  },
} satisfies PrismaConfig;
