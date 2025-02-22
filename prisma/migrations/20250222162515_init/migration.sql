-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "patientId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audioFileUrl" TEXT,
    "isInitialVisit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Note_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "gptModel" TEXT NOT NULL DEFAULT 'gpt-4-turbo-preview',
    "initialVisitPrompt" TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a note for an INITIAL VISIT based on the provided medical visit transcript.',
    "followUpVisitPrompt" TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a note for a FOLLOW-UP VISIT based on the provided medical visit transcript.',
    "autoSave" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
