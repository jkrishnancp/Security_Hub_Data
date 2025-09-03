#!/usr/bin/env node

const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.AUTH_COOKIE || '' // Would need actual session cookie
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        resolve({
          path,
          status: res.statusCode,
          time: endTime - startTime,
          size: data.length
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Timeout')));
    req.end();
  });
}

async function testPerformance() {
  console.log('🚀 Testing API performance...\n');

  const endpoints = [
    '/api/onboarding/status',
    '/api/rss-items?limit=5',
    '/api/scorecard'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const results = [];
      
      // Run 3 requests to test caching
      for (let i = 0; i < 3; i++) {
        const result = await makeRequest(endpoint);
        results.push(result);
        console.log(`  Request ${i + 1}: ${result.time}ms (${result.status}) - ${Math.round(result.size / 1024)}KB`);
      }

      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      console.log(`  Average: ${Math.round(avgTime)}ms\n`);

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
}

testPerformance().catch(console.error);