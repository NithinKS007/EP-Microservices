/*
  Warnings:

  - The values [admin,user] on the enum `enum_user_roles` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `role` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "enum_user_roles_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "public"."user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "enum_user_roles_new" USING ("role"::text::"enum_user_roles_new");
ALTER TYPE "enum_user_roles" RENAME TO "enum_user_roles_old";
ALTER TYPE "enum_user_roles_new" RENAME TO "enum_user_roles";
DROP TYPE "public"."enum_user_roles_old";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'USER';
