import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

// Check if we're running in the browser or on the server
const isClient = typeof window !== 'undefined';

// Initialize Supabase client with appropriate environment variables
export const supabase = createClient(
  isClient 
    ? process.env.NEXT_PUBLIC_SUPABASE_URL || '' 
    : process.env.SUPABASE_URL || '',
  isClient 
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' 
    : process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient 
}

// Initialize Prisma Client (now connected to PostgreSQL via the DATABASE_URL in .env.local)
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// For compatibility with existing code, provide a function that only returns the Prisma client
// This replaces the previous connectWithFallback function which had SQLite fallback
export const connectWithFallback = async () => {
  // Test connection to PostgreSQL
  await prisma.$queryRaw`SELECT 1`
  console.log('Connected to PostgreSQL database')
  return prisma
}
