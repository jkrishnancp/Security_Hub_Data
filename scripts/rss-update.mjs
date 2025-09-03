#!/usr/bin/env node

// RSS Feed Update Script for Cron Jobs
// This script can be run periodically to update RSS feeds

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple RSS parser function (extracted from the main lib)
async function fetchRSSFeed(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Security Hub RSS Aggregator/1.0',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

function parseXML(xmlString) {
  const items = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const atomEntryRegex = /<entry>(.*?)<\/entry>/gs;
  
  let match;
  
  // Parse RSS items
  while ((match = itemRegex.exec(xmlString)) !== null) {
    const itemContent = match[1];
    const item = parseItemContent(itemContent, 'rss');
    if (item) items.push(item);
  }
  
  // Parse Atom entries if no RSS items found
  if (items.length === 0) {
    while ((match = atomEntryRegex.exec(xmlString)) !== null) {
      const itemContent = match[1];
      const item = parseItemContent(itemContent, 'atom');
      if (item) items.push(item);
    }
  }
  
  return { items };
}

function parseItemContent(content, type) {
  const extractTag = (tagName, content) => {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'is');
    const match = regex.exec(content);
    return match ? match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : undefined;
  };
  
  const extractAttribute = (tagName, attribute, content) => {
    const regex = new RegExp(`<${tagName}[^>]*${attribute}=["']([^"']*?)["'][^>]*>`, 'i');
    const match = regex.exec(content);
    return match ? match[1] : undefined;
  };
  
  if (type === 'rss') {
    const title = extractTag('title', content);
    const link = extractTag('link', content);
    
    if (!title || !link) return null;
    
    return {
      title,
      description: extractTag('description', content) || extractTag('summary', content),
      link,
      pubDate: extractTag('pubDate', content),
      author: extractTag('author', content) || extractTag('dc:creator', content),
      category: extractTag('category', content)
    };
  } else {
    const title = extractTag('title', content);
    const link = extractAttribute('link', 'href', content) || extractTag('link', content);
    
    if (!title || !link) return null;
    
    return {
      title,
      description: extractTag('summary', content) || extractTag('content', content),
      link,
      pubDate: extractTag('updated', content) || extractTag('published', content),
      author: extractTag('name', content),
      category: extractAttribute('category', 'term', content)
    };
  }
}

function classifySeverity(title, description = '') {
  const content = `${title} ${description}`.toLowerCase();
  
  const criticalKeywords = ['critical', 'severe', 'emergency', 'exploit', 'rce', 'remote code execution'];
  const highKeywords = ['high', 'urgent', 'vulnerability', 'security', 'breach', 'attack'];
  const mediumKeywords = ['medium', 'warning', 'advisory', 'patch', 'update'];
  const lowKeywords = ['low', 'info', 'notice', 'maintenance'];

  if (criticalKeywords.some(keyword => content.includes(keyword))) {
    return 'CRITICAL';
  }
  if (highKeywords.some(keyword => content.includes(keyword))) {
    return 'HIGH';
  }
  if (mediumKeywords.some(keyword => content.includes(keyword))) {
    return 'MEDIUM';
  }
  if (lowKeywords.some(keyword => content.includes(keyword))) {
    return 'LOW';
  }
  
  return 'INFO';
}

async function updateRSSFeeds() {
  console.log(`[${new Date().toISOString()}] Starting RSS feed update...`);
  
  try {
    // Get all active RSS feeds
    const activeFeeds = await prisma.rssFeed.findMany({
      where: { active: true }
    });
    
    console.log(`Found ${activeFeeds.length} active RSS feeds`);
    
    let successful = 0;
    let failed = 0;
    let totalNewItems = 0;
    
    // Process each feed
    for (const feed of activeFeeds) {
      try {
        console.log(`Processing feed: ${feed.name} (${feed.url})`);
        
        const xmlContent = await fetchRSSFeed(feed.url);
        const parsedFeed = parseXML(xmlContent);
        
        let newItemsCount = 0;
        
        // Process each item
        for (const item of parsedFeed.items) {
          try {
            // Check if item already exists
            const existingItem = await prisma.rssItem.findUnique({
              where: { link: item.link }
            });
            
            if (!existingItem) {
              // Parse publication date
              let pubDate = null;
              if (item.pubDate) {
                pubDate = new Date(item.pubDate);
                if (isNaN(pubDate.getTime())) {
                  pubDate = null;
                }
              }
              
              // Classify severity
              const severity = classifySeverity(item.title, item.description);
              
              // Create new RSS item
              await prisma.rssItem.create({
                data: {
                  feedId: feed.id,
                  title: item.title,
                  description: item.description,
                  link: item.link,
                  pubDate,
                  author: item.author,
                  category: item.category,
                  severity
                }
              });
              
              newItemsCount++;
            }
          } catch (itemError) {
            console.error(`Error processing item: ${item.link}`, itemError);
          }
        }
        
        // Update feed's last fetch time
        await prisma.rssFeed.update({
          where: { id: feed.id },
          data: {
            lastFetched: new Date(),
            fetchError: null
          }
        });
        
        console.log(`  ✓ ${feed.name}: ${newItemsCount} new items`);
        successful++;
        totalNewItems += newItemsCount;
        
      } catch (feedError) {
        console.error(`  ✗ ${feed.name}: ${feedError.message}`);
        
        // Update feed with error
        await prisma.rssFeed.update({
          where: { id: feed.id },
          data: {
            fetchError: feedError.message,
            lastFetched: new Date()
          }
        });
        
        failed++;
      }
    }
    
    console.log(`[${new Date().toISOString()}] RSS update completed:`);
    console.log(`  - ${successful} feeds successful`);
    console.log(`  - ${failed} feeds failed`);
    console.log(`  - ${totalNewItems} new items total`);
    
  } catch (error) {
    console.error(`RSS update failed: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateRSSFeeds();