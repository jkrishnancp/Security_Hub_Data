// RSS Feed Scheduler Service
// This file provides utilities for scheduled RSS feed updates

import { fetchAllActiveRSSFeeds } from './rss-parser';

export interface ScheduledTaskResult {
  timestamp: string;
  taskType: 'rss-update';
  success: boolean;
  message: string;
  details?: any;
}

export async function runScheduledRSSUpdate(): Promise<ScheduledTaskResult> {
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[${timestamp}] Starting scheduled RSS feed update...`);
    
    const results = await fetchAllActiveRSSFeeds();
    
    const message = `RSS update completed: ${results.successful} successful, ${results.failed} failed out of ${results.total} feeds`;
    
    console.log(`[${timestamp}] ${message}`);
    
    return {
      timestamp,
      taskType: 'rss-update',
      success: true,
      message,
      details: results
    };
    
  } catch (error) {
    const message = `RSS update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    console.error(`[${timestamp}] ${message}`);
    
    return {
      timestamp,
      taskType: 'rss-update',
      success: false,
      message,
      details: { error: error instanceof Error ? error.message : error }
    };
  }
}

// Simple in-memory scheduler (for development/testing)
export class SimpleScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Schedule RSS updates every 4 hours
  startRSSUpdateScheduler() {
    console.log('Starting RSS update scheduler (every 4 hours)...');
    
    const intervalId = setInterval(async () => {
      await runScheduledRSSUpdate();
    }, 4 * 60 * 60 * 1000); // 4 hours in milliseconds
    
    this.intervals.set('rss-update', intervalId);
    
    // Run initial update after 1 minute
    setTimeout(() => {
      runScheduledRSSUpdate();
    }, 60 * 1000);
  }
  
  stopRSSUpdateScheduler() {
    const intervalId = this.intervals.get('rss-update');
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete('rss-update');
      console.log('Stopped RSS update scheduler');
    }
  }
  
  stopAllSchedulers() {
    this.intervals.forEach((intervalId, name) => {
      clearInterval(intervalId);
      console.log(`Stopped scheduler: ${name}`);
    });
    this.intervals.clear();
  }
}

// Global scheduler instance (singleton)
let globalScheduler: SimpleScheduler | null = null;

export function getScheduler(): SimpleScheduler {
  if (!globalScheduler) {
    globalScheduler = new SimpleScheduler();
  }
  return globalScheduler;
}

/**
 * PRODUCTION SETUP INSTRUCTIONS:
 * 
 * For production environments, it's recommended to use external cron jobs instead of in-memory scheduling:
 * 
 * 1. USING SYSTEM CRON (Linux/macOS):
 * 
 * Add this to your crontab (crontab -e):
 * # RSS Feed Update every 4 hours
 * 0 4,8,12,16,20,0 * * * curl -X POST http://localhost:3000/api/rss-feeds/schedule -H "Content-Type: application/json"
 * 
 * 2. USING PM2 (if using PM2 for process management):
 * 
 * Create ecosystem.config.js:
 * module.exports = {
 *   apps: [{
 *     name: 'rss-scheduler',
 *     script: 'node_modules/.bin/tsx',
 *     args: './scripts/rss-cron.ts',
 *     cron_restart: '0 4,8,12,16,20,0 * * *',
 *     autorestart: false
 *   }]
 * };
 * 
 * 3. USING VERCEL CRON (if deployed on Vercel):
 * 
 * Add to vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/rss-feeds/schedule",
 *       "schedule": "0 4,8,12,16,20,0 * * *"
 *     }
 *   ]
 * }
 * 
 * 4. USING GITHUB ACTIONS (for scheduled CI/CD tasks):
 * 
 * Create .github/workflows/rss-update.yml:
 * name: RSS Feed Update
 * on:
 *   schedule:
 *     - cron: '0 4,8,12,16,20,0 * * *'
 * jobs:
 *   update:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - name: Update RSS Feeds
 *         run: |
 *           curl -X POST ${{ secrets.APP_URL }}/api/rss-feeds/schedule \
 *             -H "Content-Type: application/json"
 * 
 * 5. USING DOCKER CRON:
 * 
 * Add to Dockerfile:
 * RUN apt-get update && apt-get install -y cron
 * COPY crontab /etc/cron.d/rss-cron
 * RUN chmod 0644 /etc/cron.d/rss-cron
 * RUN crontab /etc/cron.d/rss-cron
 * 
 * Create crontab file:
 * 0 4,8,12,16,20,0 * * * curl -X POST http://localhost:3000/api/rss-feeds/schedule
 * 
 * 6. MONITORING AND LOGGING:
 * 
 * Consider adding monitoring to track:
 * - RSS feed update success/failure rates  
 * - Feed response times
 * - Number of new items fetched
 * - Failed feed URLs for debugging
 * 
 * You can extend the scheduler to log to a database or external monitoring service.
 */