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
CREATE TABLE "SOAPNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "patientId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "subjective" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "audioFileUrl" TEXT,
    "isInitialVisit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SOAPNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "gptModel" TEXT NOT NULL DEFAULT 'gpt-4',
    "initialVisitPrompt" TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a SOAP note for an INITIAL VISIT based on the provided medical visit transcript.',
    "followUpVisitPrompt" TEXT NOT NULL DEFAULT 'You are a medical scribe assistant. Your task is to generate a SOAP note for a FOLLOW-UP VISIT based on the provided medical visit transcript.',
    "updatedAt" DATETIME NOT NULL
);
