-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "businessUnit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ingestion_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "reportDate" DATETIME NOT NULL,
    "importedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorLog" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vulnerabilities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetName" TEXT NOT NULL,
    "businessUnit" TEXT NOT NULL,
    "cveId" TEXT,
    "severity" TEXT NOT NULL,
    "slaDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "detection_falcon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "username" TEXT,
    "severity" TEXT NOT NULL,
    "tactic" TEXT,
    "technique" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "detection_secureworks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "responseAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "phishing_jira" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "businessUnit" TEXT NOT NULL,
    "timeToResolution" INTEGER,
    "description" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "aws_security_hub_findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "complianceStatus" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "foundAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "attendees" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "businessUnit" TEXT,
    "meetingMinuteId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "action_items_meetingMinuteId_fkey" FOREIGN KEY ("meetingMinuteId") REFERENCES "meeting_minutes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "threat_advisories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threatAdvisoryName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "netgearSeverity" TEXT NOT NULL,
    "impacted" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "advisoryReleasedDate" TEXT NOT NULL,
    "notifiedDate" TEXT NOT NULL,
    "remarks" TEXT,
    "etaForFix" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "issue_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "businessUnit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "openedDate" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "scorecard_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseScore" REAL NOT NULL DEFAULT 100.0,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "currentScore" REAL NOT NULL DEFAULT 100.0,
    "lastCalculated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "scorecard_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "openedDate" DATETIME NOT NULL,
    "slaDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "businessUnit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" REAL NOT NULL DEFAULT 1.0,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "vulnerabilities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "detection_falcon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "detection_secureworks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "phishing_jira" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "aws_security_hub_findings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "action_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "threat_advisories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scorecard_issues_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "issue_reports" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scorecard_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportDate" DATETIME NOT NULL,
    "company" TEXT,
    "generatedBy" TEXT,
    "overallScore" REAL NOT NULL,
    "letterGrade" TEXT NOT NULL,
    "breakdown" TEXT,
    "threatIndicatorsScore" REAL,
    "networkSecurityScore" REAL,
    "dnsHealthScore" REAL,
    "patchingCadenceScore" REAL,
    "endpointSecurityScore" REAL,
    "ipReputationScore" REAL,
    "applicationSecurityScore" REAL,
    "cubitScore" REAL,
    "hackerChatterScore" REAL,
    "informationLeakScore" REAL,
    "socialEngineeringScore" REAL,
    "industry" TEXT,
    "companyWebsite" TEXT,
    "findingsOnOpenPorts" INTEGER,
    "siteVulnerabilities" INTEGER,
    "malwareDiscovered" INTEGER,
    "leakedInformation" INTEGER,
    "numberOfIpAddressesScanned" INTEGER,
    "numberOfDomainNamesScanned" INTEGER,
    "businessUnit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "scorecard_issue_details" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "factorName" TEXT NOT NULL,
    "issueTypeTitle" TEXT NOT NULL,
    "issueTypeCode" TEXT NOT NULL,
    "issueTypeSeverity" TEXT NOT NULL,
    "issueRecommendation" TEXT,
    "firstSeen" DATETIME,
    "lastSeen" DATETIME,
    "ipAddresses" TEXT,
    "hostname" TEXT,
    "subdomain" TEXT,
    "target" TEXT,
    "ports" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cveId" TEXT,
    "description" TEXT,
    "timeSincePublished" TEXT,
    "timeOpenSincePublished" TEXT,
    "cookieName" TEXT,
    "data" TEXT,
    "commonName" TEXT,
    "keyLength" TEXT,
    "usingRC4" BOOLEAN,
    "issuerOrganizationName" TEXT,
    "provider" TEXT,
    "detectedService" TEXT,
    "product" TEXT,
    "version" TEXT,
    "platform" TEXT,
    "browser" TEXT,
    "destinationIps" TEXT,
    "malwareFamily" TEXT,
    "malwareType" TEXT,
    "detectionMethod" TEXT,
    "label" TEXT,
    "initialUrl" TEXT,
    "finalUrl" TEXT,
    "requestChain" TEXT,
    "headers" TEXT,
    "analysis" TEXT,
    "percentSimilarCompanies" REAL,
    "averageFindings" REAL,
    "issueTypeScoreImpact" REAL NOT NULL DEFAULT 0.0,
    "reportDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "open_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee" TEXT,
    "priority" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME,
    "closedAt" DATETIME,
    "reportDate" DATETIME,
    "issueType" TEXT,
    "labels" TEXT,
    "epic" TEXT,
    "sprint" TEXT,
    "storyPoints" INTEGER,
    "dueDate" DATETIME,
    "resolution" TEXT,
    "reporter" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtSystem" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "detection_falcon_eventId_key" ON "detection_falcon"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "detection_secureworks_eventId_key" ON "detection_secureworks"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "phishing_jira_issueId_key" ON "phishing_jira"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "aws_security_hub_findings_findingId_key" ON "aws_security_hub_findings"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_reports_issueId_key" ON "issue_reports"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_categories_name_key" ON "scorecard_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_ratings_reportDate_key" ON "scorecard_ratings"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_issue_details_issueId_key" ON "scorecard_issue_details"("issueId");
