-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "mediaUploadError" TEXT,
ADD COLUMN     "mediaUploadProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mediaUploadStatus" TEXT NOT NULL DEFAULT 'none';
