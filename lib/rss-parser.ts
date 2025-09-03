import { prisma } from '@/lib/prisma';
import { SeverityLevel } from '@prisma/client';

interface RssItem {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
  author?: string;
  category?: string;
}

interface RssFeed {
  title?: string;
  description?: string;
  items: RssItem[];
}

// Simple XML parser for Node.js environment
function parseXML(xmlString: string): any {
  // Remove XML declaration and namespaces for simplicity
  const cleanXml = xmlString.replace(/<\?xml.*?\?>/, '').replace(/\s+xmlns[^=]*="[^"]*"/g, '');
  
  // Simple regex-based parsing (for production, consider using a proper XML parser like 'fast-xml-parser')
  const items: RssItem[] = [];
  
  // Match RSS items
  const itemRegex = /<item>(.*?)<\/item>/gs;
  const atomEntryRegex = /<entry>(.*?)<\/entry>/gs;
  
  let match;
  
  // Parse RSS items
  while ((match = itemRegex.exec(cleanXml)) !== null) {
    const itemContent = match[1];
    const item = parseItemContent(itemContent, 'rss');
    if (item) items.push(item);
  }
  
  // Parse Atom entries if no RSS items found
  if (items.length === 0) {
    while ((match = atomEntryRegex.exec(cleanXml)) !== null) {
      const itemContent = match[1];
      const item = parseItemContent(itemContent, 'atom');
      if (item) items.push(item);
    }
  }
  
  return { items };
}

function parseItemContent(content: string, type: 'rss' | 'atom'): RssItem | null {
  const extractTag = (tagName: string, content: string): string | undefined => {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'is');
    const match = regex.exec(content);
    return match ? match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() : undefined;
  };
  
  const extractAttribute = (tagName: string, attribute: string, content: string): string | undefined => {
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
      author: extractTag('author', content) || extractTag('dc:creator', content) || extractTag('creator', content),
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
      category: extractAttribute('category', 'term', content) || extractTag('category', content)
    };
  }
}

function getTextContent(element: Element | null): string | undefined {
  return element?.textContent?.trim() || undefined;
}

function parseRSSFeed(xmlString: string): RssFeed {
  return parseXML(xmlString);
}

// Enhanced vulnerability data extraction
interface VulnerabilityData {
  cves: string[];
  cvss: number | null;
  affectedProducts: string[];
  severity: SeverityLevel;
  tags: string[];
}

function extractVulnerabilityData(title: string, description?: string): VulnerabilityData {
  const content = `${title} ${description || ''}`;
  const contentLower = content.toLowerCase();
  
  // Extract CVEs
  const cvePattern = /CVE-\d{4}-\d{4,}/gi;
  const cves = Array.from(content.matchAll(cvePattern)).map(match => match[0].toUpperCase());
  
  // Extract CVSS scores
  const cvssPattern = /CVSS[:\s]*(?:score[:\s]*)?(\d{1,2}\.?\d?)/gi;
  const cvssMatches = Array.from(content.matchAll(cvssPattern));
  const cvss = cvssMatches.length > 0 ? parseFloat(cvssMatches[0][1]) : null;
  
  // Extract affected products/applications
  const affectedProducts: string[] = [];
  const productPatterns = [
    /(?:affects?|vulnerable|impacted?)[:\s]+([^.,\n]+)/gi,
    /(?:in|for)\s+([\w\s]+?)(?:\s+(?:version|v\d|before|prior|up to))/gi,
    /(Windows|Linux|macOS|Android|iOS|Chrome|Firefox|Safari|Apache|Nginx|MySQL|PostgreSQL|Oracle|Microsoft|Adobe|Java|PHP|Python|Node\.js)/gi
  ];
  
  productPatterns.forEach(pattern => {
    const matches = Array.from(content.matchAll(pattern));
    matches.forEach(match => {
      const product = match[1]?.trim();
      if (product && product.length > 2 && product.length < 50) {
        affectedProducts.push(product);
      }
    });
  });
  
  // Generate tags based on content analysis
  const tags: string[] = [];
  
  if (cves.length > 0) tags.push('CVE');
  if (cvss !== null) tags.push('CVSS');
  if (contentLower.includes('zero-day') || contentLower.includes('0-day')) tags.push('Zero-Day');
  if (contentLower.includes('ransomware')) tags.push('Ransomware');
  if (contentLower.includes('apt') || contentLower.includes('advanced persistent threat')) tags.push('APT');
  if (contentLower.includes('malware')) tags.push('Malware');
  if (contentLower.includes('phishing')) tags.push('Phishing');
  if (contentLower.includes('patch') || contentLower.includes('update')) tags.push('Patch');
  if (contentLower.includes('disclosure') || contentLower.includes('advisory')) tags.push('Disclosure');
  if (contentLower.includes('exploit')) tags.push('Exploit');
  if (contentLower.includes('breach') || contentLower.includes('data breach')) tags.push('Data Breach');
  if (contentLower.includes('iot') || contentLower.includes('internet of things')) tags.push('IoT');
  if (contentLower.includes('cloud') || contentLower.includes('aws') || contentLower.includes('azure')) tags.push('Cloud');
  if (contentLower.includes('mobile') || contentLower.includes('android') || contentLower.includes('ios')) tags.push('Mobile');
  
  // Determine severity based on various factors
  const severity = classifySeverity(title, description, cves, cvss, tags);
  
  return {
    cves: Array.from(new Set(cves)), // Remove duplicates
    cvss,
    affectedProducts: Array.from(new Set(affectedProducts)), // Remove duplicates
    severity,
    tags: Array.from(new Set(tags)) // Remove duplicates
  };
}

function classifySeverity(title: string, description?: string, cves: string[] = [], cvss: number | null = null, tags: string[] = []): SeverityLevel {
  const content = `${title} ${description || ''}`.toLowerCase();
  
  // CVSS-based classification (takes priority)
  if (cvss !== null) {
    if (cvss >= 9.0) return 'CRITICAL';
    if (cvss >= 7.0) return 'HIGH';
    if (cvss >= 4.0) return 'MEDIUM';
    if (cvss >= 0.1) return 'LOW';
  }
  
  // Tag-based classification
  if (tags.includes('Zero-Day') || tags.includes('APT') || tags.includes('Ransomware')) {
    return 'CRITICAL';
  }
  
  // CVE count consideration
  if (cves.length >= 3) return 'HIGH';
  if (cves.length >= 1) return 'MEDIUM';
  
  // Keyword-based classification (existing logic)
  const criticalKeywords = ['critical', 'severe', 'emergency', 'exploit', 'rce', 'remote code execution', 'unauthenticated'];
  const highKeywords = ['high', 'urgent', 'vulnerability', 'security', 'breach', 'attack', 'bypass'];
  const mediumKeywords = ['medium', 'warning', 'advisory', 'patch', 'update', 'disclosure'];
  const lowKeywords = ['low', 'info', 'notice', 'maintenance', 'information'];

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

export async function fetchAndParseRSSFeed(feedId: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get RSS feed details
    const rssFeed = await prisma.rssFeed.findUnique({
      where: { id: feedId }
    });

    if (!rssFeed || !rssFeed.active) {
      return { success: false, count: 0, error: 'RSS feed not found or inactive' };
    }

    // Fetch RSS feed content
    const response = await fetch(rssFeed.url, {
      headers: {
        'User-Agent': 'Security Hub RSS Aggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) {
      const error = `HTTP ${response.status}: ${response.statusText}`;
      await prisma.rssFeed.update({
        where: { id: feedId },
        data: { 
          fetchError: error,
          lastFetched: new Date()
        }
      });
      return { success: false, count: 0, error };
    }

    const xmlContent = await response.text();
    
    // Parse RSS content using our simple XML parser
    const parsedFeed = parseRSSFeed(xmlContent);

    let newItemsCount = 0;

    // Process each RSS item
    for (const item of parsedFeed.items) {
      try {
        // Check if item already exists
        const existingItem = await prisma.rssItem.findUnique({
          where: { link: item.link }
        });

        if (!existingItem) {
          // Parse publication date
          let pubDate: Date | null = null;
          if (item.pubDate) {
            pubDate = new Date(item.pubDate);
            if (isNaN(pubDate.getTime())) {
              pubDate = null;
            }
          }

          // Extract vulnerability data
          const vulnData = extractVulnerabilityData(item.title, item.description);

          // Create new RSS item
          await prisma.rssItem.create({
            data: {
              feedId: feedId,
              title: item.title,
              description: item.description,
              link: item.link,
              pubDate,
              author: item.author,
              category: item.category,
              severity: vulnData.severity,
              tags: JSON.stringify(vulnData.tags),
              cves: vulnData.cves.length > 0 ? JSON.stringify(vulnData.cves) : null,
              cvssScore: vulnData.cvss,
              affectedProducts: vulnData.affectedProducts.length > 0 ? JSON.stringify(vulnData.affectedProducts) : null
            }
          });

          newItemsCount++;
        }
      } catch (itemError) {
        console.error(`Error processing RSS item: ${item.link}`, itemError);
        // Continue processing other items
      }
    }

    // Update feed's last fetch time and clear any previous errors
    await prisma.rssFeed.update({
      where: { id: feedId },
      data: {
        lastFetched: new Date(),
        fetchError: null
      }
    });

    return { success: true, count: newItemsCount };

  } catch (error) {
    console.error(`Error fetching RSS feed ${feedId}:`, error);
    
    // Update feed with error
    await prisma.rssFeed.update({
      where: { id: feedId },
      data: {
        fetchError: error instanceof Error ? error.message : 'Unknown error',
        lastFetched: new Date()
      }
    });

    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function fetchAllActiveRSSFeeds(): Promise<{ total: number; successful: number; failed: number; details: Array<{ feedId: string; name: string; success: boolean; count?: number; error?: string }> }> {
  // Get all active RSS feeds
  const activeFeeds = await prisma.rssFeed.findMany({
    where: { active: true },
    select: { id: true, name: true }
  });

  const results = {
    total: activeFeeds.length,
    successful: 0,
    failed: 0,
    details: [] as Array<{ feedId: string; name: string; success: boolean; count?: number; error?: string }>
  };

  // Process feeds in parallel (but limit concurrency to avoid overwhelming servers)
  const BATCH_SIZE = 5;
  for (let i = 0; i < activeFeeds.length; i += BATCH_SIZE) {
    const batch = activeFeeds.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (feed) => {
        const result = await fetchAndParseRSSFeed(feed.id);
        return {
          feedId: feed.id,
          name: feed.name,
          success: result.success,
          count: result.count,
          error: result.error
        };
      })
    );

    results.details.push(...batchResults);
    
    // Update counters
    batchResults.forEach(result => {
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }
    });

    // Add small delay between batches to be nice to servers
    if (i + BATCH_SIZE < activeFeeds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}