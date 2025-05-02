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

// Create a fallback function to SQLite if Postgres connection fails
export const connectWithFallback = async () => {
  try {
    // Test connection to PostgreSQL
    await prisma.$queryRaw`SELECT 1`
    console.log('Connected to PostgreSQL database')
    return prisma
  } catch (error) {
    console.error('Failed to connect to PostgreSQL, falling back to SQLite', error)
    
    // If we have a SQLite connection string, use it as fallback
    if (process.env.SQLITE_DATABASE_URL) {
      const sqlitePrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.SQLITE_DATABASE_URL,
          },
        },
      })
      
      return sqlitePrisma
    }
    
    // If no fallback is available, rethrow the error
    throw error
  }
}
