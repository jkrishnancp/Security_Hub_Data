-- Add indexes for better query performance

-- Scorecard ratings indexes
CREATE INDEX IF NOT EXISTS "idx_scorecard_ratings_report_date" ON "scorecard_ratings" ("reportDate" DESC);

-- Scorecard issue details indexes  
CREATE INDEX IF NOT EXISTS "idx_scorecard_issue_details_report_date" ON "scorecard_issue_details" ("reportDate" DESC);
CREATE INDEX IF NOT EXISTS "idx_scorecard_issue_details_status" ON "scorecard_issue_details" ("status");
CREATE INDEX IF NOT EXISTS "idx_scorecard_issue_details_severity" ON "scorecard_issue_details" ("issueTypeSeverity");
CREATE INDEX IF NOT EXISTS "idx_scorecard_issue_details_active_date" ON "scorecard_issue_details" ("status", "reportDate" DESC) WHERE "status" = 'active';

-- RSS items indexes
CREATE INDEX IF NOT EXISTS "idx_rss_items_pub_date" ON "rss_items" ("pubDate" DESC);
CREATE INDEX IF NOT EXISTS "idx_rss_items_severity" ON "rss_items" ("severity");
CREATE INDEX IF NOT EXISTS "idx_rss_items_feed_id" ON "rss_items" ("feedId");
CREATE INDEX IF NOT EXISTS "idx_rss_items_read" ON "rss_items" ("read");

-- Users indexes
CREATE INDEX IF NOT EXISTS "idx_users_role_active" ON "users" ("role", "active");

-- General compound indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_rss_items_feed_date" ON "rss_items" ("feedId", "pubDate" DESC);
CREATE INDEX IF NOT EXISTS "idx_scorecard_issue_details_factor_severity" ON "scorecard_issue_details" ("factorName", "issueTypeSeverity");