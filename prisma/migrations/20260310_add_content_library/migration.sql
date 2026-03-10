-- Content Library: Pre-generated assessment content for low-latency delivery
-- Stores all scenario content at role creation time instead of generating live

-- New enum for content library status
CREATE TYPE "ContentLibraryStatus" AS ENUM ('GENERATING', 'READY', 'FAILED', 'DEPRECATED');

-- New table: ContentLibrary
CREATE TABLE "ContentLibrary" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ContentLibraryStatus" NOT NULL DEFAULT 'GENERATING',
    "content" JSONB NOT NULL,
    "generationStartedAt" TIMESTAMP(3),
    "generationCompletedAt" TIMESTAMP(3),
    "errorLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentLibrary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentLibrary_roleId_version_key" ON "ContentLibrary"("roleId", "version");
CREATE INDEX "ContentLibrary_roleId_status_idx" ON "ContentLibrary"("roleId", "status");
ALTER TABLE "ContentLibrary" ADD CONSTRAINT "ContentLibrary_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add content library reference to AssessmentState
ALTER TABLE "AssessmentState" ADD COLUMN "contentLibraryId" TEXT;
ALTER TABLE "AssessmentState" ADD COLUMN "variantSelections" JSONB;
