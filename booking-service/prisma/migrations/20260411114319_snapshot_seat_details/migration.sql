/*
  Warnings:

  - Added the required column `seat_number` to the `bookingSeat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seat_tier` to the `bookingSeat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookingSeat" ADD COLUMN     "seat_number" TEXT NOT NULL,
ADD COLUMN     "seat_tier" TEXT NOT NULL;
