const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

let prisma;

try {
  const logConfig = process.env.NODE_ENV === 'development' ? ['error', 'warn'] : process.env.NODE_ENV === 'test' ? [] : ['error'];
  prisma = globalForPrisma.prisma || new PrismaClient({
    log: logConfig
  });
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
} catch (err) {
  prisma = {};
}

module.exports = prisma;
