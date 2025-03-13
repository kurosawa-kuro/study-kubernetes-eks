/*
  Warnings:

  - The primary key for the `guestbook` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `guestbook` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guestbook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_guestbook" ("created_at", "id", "message", "name") SELECT "created_at", "id", "message", "name" FROM "guestbook";
DROP TABLE "guestbook";
ALTER TABLE "new_guestbook" RENAME TO "guestbook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
