/*
  Warnings:

  - You are about to drop the column `account` on the `aws_security_hub_findings` table. All the data in the column will be lost.
  - You are about to drop the column `complianceStatus` on the `aws_security_hub_findings` table. All the data in the column will be lost.
  - You are about to drop the column `findingId` on the `aws_security_hub_findings` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `aws_security_hub_findings` table. All the data in the column will be lost.
  - Added the required column `controlStatus` to the `aws_security_hub_findings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `aws_security_hub_findings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
ALTER TABLE "users" ADD COLUMN "bio" TEXT;
ALTER TABLE "users" ADD COLUMN "department" TEXT;
ALTER TABLE "users" ADD COLUMN "displayName" TEXT;
ALTER TABLE "users" ADD COLUMN "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN "lastName" TEXT;
ALTER TABLE "users" ADD COLUMN "location" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "secureworks_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alert_id" TEXT NOT NULL,
    "title" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "threat_score" REAL,
    "detector" TEXT,
    "sensor_type" TEXT,
    "domain" TEXT,
    "combined_username" TEXT,
    "source_ip" TEXT,
    "destination_ip" TEXT,
    "hostname" TEXT,
    "investigations" TEXT,
    "confidence" REAL,
    "mitre_attack" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "status_reason" TEXT,
    "tenant_id" TEXT,
    "occurrence_count" INTEGER,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detected_at" DATETIME,
    "false_positive" BOOLEAN NOT NULL DEFAULT false,
    "ingested_on" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "rss_feeds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFetched" DATETIME,
    "fetchError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "rss_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "link" TEXT NOT NULL,
    "pubDate" DATETIME,
    "author" TEXT,
    "category" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "tags" TEXT,
    "content" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rss_items_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "rss_feeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_aws_security_hub_findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "controlStatus" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "failedChecks" INTEGER NOT NULL DEFAULT 0,
    "unknownChecks" INTEGER NOT NULL DEFAULT 0,
    "notAvailableChecks" INTEGER NOT NULL DEFAULT 0,
    "passedChecks" INTEGER NOT NULL DEFAULT 0,
    "relatedRequirements" TEXT,
    "customParameters" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "reportDate" DATETIME,
    "foundAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_aws_security_hub_findings" ("controlId", "createdAt", "description", "foundAt", "id", "resolvedAt", "severity", "status", "updatedAt") SELECT "controlId", "createdAt", "description", "foundAt", "id", "resolvedAt", "severity", "status", "updatedAt" FROM "aws_security_hub_findings";
DROP TABLE "aws_security_hub_findings";
ALTER TABLE "new_aws_security_hub_findings" RENAME TO "aws_security_hub_findings";
CREATE UNIQUE INDEX "aws_security_hub_findings_controlId_key" ON "aws_security_hub_findings"("controlId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "secureworks_alerts_alert_id_key" ON "secureworks_alerts"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "rss_feeds_url_key" ON "rss_feeds"("url");

-- CreateIndex
CREATE UNIQUE INDEX "rss_items_link_key" ON "rss_items"("link");
