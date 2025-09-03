#!/usr/bin/env node

// Import RSS Feeds from FreshRSS to Security Hub
// This script transfers all feeds from FreshRSS SQLite database to the Security Hub database

import { PrismaClient } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const prisma = new PrismaClient();

// FreshRSS database path
const FRESHRSS_DB_PATH = '/tmp/freshrss-import.db';

async function importFeedsFromFreshRSS() {
  console.log(`[${new Date().toISOString()}] Starting FreshRSS feed import...`);
  
  try {
    // Open FreshRSS SQLite database
    const freshRssDb = await open({
      filename: FRESHRSS_DB_PATH,
      driver: sqlite3.Database
    });
    
    console.log('✓ Connected to FreshRSS database');
    
    // Get all feeds from FreshRSS
    const freshRssFeeds = await freshRssDb.all(`
      SELECT 
        f.id,
        f.name,
        f.url,
        f.description,
        f.website,
        f.error,
        f.lastUpdate,
        c.name as category_name
      FROM feed f
      LEFT JOIN category c ON f.category = c.id
      ORDER BY f.name
    `);
    
    console.log(`Found ${freshRssFeeds.length} feeds in FreshRSS`);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Import each feed
    for (const feed of freshRssFeeds) {
      try {
        // Check if feed already exists in Security Hub
        const existingFeed = await prisma.rssFeed.findUnique({
          where: { url: feed.url }
        });
        
        if (existingFeed) {
          console.log(`  ⏭️  Skipped: ${feed.name} (already exists)`);
          skipped++;
          continue;
        }
        
        // Determine category - use 'General' if no category
        const category = feed.category_name || 'General';
        
        // Create new feed in Security Hub
        await prisma.rssFeed.create({
          data: {
            name: feed.name,
            url: feed.url,
            category: category,
            active: true, // Always set active on import
            lastFetched: feed.lastUpdate ? new Date(feed.lastUpdate * 1000) : null,
            fetchError: null, // Clear any previous errors
          }
        });
        
        console.log(`  ✅ Imported: ${feed.name} (${category})`);
        imported++;
        
      } catch (feedError) {
        console.error(`  ❌ Error importing feed "${feed.name}": ${feedError.message}`);
        errors++;
      }
    }
    
    await freshRssDb.close();
    console.log('✓ Closed FreshRSS database connection');
    
    console.log(`\n[${new Date().toISOString()}] Import completed:`);
    console.log(`  ✅ ${imported} feeds imported successfully`);
    console.log(`  ⏭️  ${skipped} feeds skipped (already exist)`);
    console.log(`  ❌ ${errors} feeds failed to import`);
    
    if (imported > 0) {
      console.log(`\n🎉 Successfully imported ${imported} RSS feeds!`);
      console.log('You can now run the RSS update script to fetch articles:');
      console.log('  node scripts/rss-update.mjs');
    }
    
  } catch (error) {
    console.error(`❌ Import failed: ${error.message}`);
    console.error('Make sure you have read permissions for the FreshRSS database:');
    console.error(`  sudo chmod +r ${FRESHRSS_DB_PATH}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Also create a function to import specific categories
async function importSpecificCategory(categoryName) {
  console.log(`[${new Date().toISOString()}] Importing feeds from category: ${categoryName}`);
  
  try {
    const freshRssDb = await open({
      filename: FRESHRSS_DB_PATH,
      driver: sqlite3.Database
    });
    
    const categoryFeeds = await freshRssDb.all(`
      SELECT 
        f.id,
        f.name,
        f.url,
        f.description,
        f.error,
        f.lastUpdate,
        c.name as category_name
      FROM feed f
      LEFT JOIN category c ON f.category = c.id
      WHERE c.name = ? OR (c.name IS NULL AND ? = 'Uncategorized')
      ORDER BY f.name
    `, [categoryName, categoryName]);
    
    console.log(`Found ${categoryFeeds.length} feeds in category "${categoryName}"`);
    
    // Process feeds similar to main import function
    // ... (rest of import logic)
    
    await freshRssDb.close();
    
  } catch (error) {
    console.error(`Failed to import category ${categoryName}: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
if (process.argv[2] === '--category' && process.argv[3]) {
  importSpecificCategory(process.argv[3]);
} else {
  importFeedsFromFreshRSS();
}