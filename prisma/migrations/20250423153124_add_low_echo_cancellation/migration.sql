-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "gptModel" TEXT NOT NULL DEFAULT 'gpt-4o',
    "initialVisitPrompt" TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a note for an INITIAL VISIT based on the provided medical visit transcript.',
    "followUpVisitPrompt" TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a note for a FOLLOW-UP VISIT based on the provided medical visit transcript.',
    "autoSave" BOOLEAN NOT NULL DEFAULT false,
    "lowEchoCancellation" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("autoSave", "darkMode", "followUpVisitPrompt", "gptModel", "id", "initialVisitPrompt", "updatedAt") SELECT "autoSave", "darkMode", "followUpVisitPrompt", "gptModel", "id", "initialVisitPrompt", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
