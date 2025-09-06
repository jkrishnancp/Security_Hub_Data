// Clears all rows from Tool Metrics – XDR (Secureworks)
// Usage: node scripts/clear_xdr_tool_metrics.js [YYYY-MM]
// If YYYY-MM provided, clears only that month; otherwise clears all.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return null;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { gte: start, lt: end };
}

(async () => {
  try {
    const arg = process.argv[2];
    let where = {};
    if (arg) {
      const range = monthRange(arg);
      if (!range) throw new Error('Invalid YYYY-MM argument');
      where = { periodMonth: range };
    }

    const before = await prisma.toolMetricsXdr.count();
    const res = await prisma.toolMetricsXdr.deleteMany({ where });
    const after = await prisma.toolMetricsXdr.count();
    console.log(JSON.stringify({ before, deleted: res.count, after }, null, 2));
  } catch (e) {
    console.error('Error clearing tool_metrics_xdr:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();

