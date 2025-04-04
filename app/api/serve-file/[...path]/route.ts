import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { readFile } from 'fs/promises'

// Simplified handler with a clearer signature
export async function GET(
  request: NextRequest
) {
  try {
    // Extract the path from the URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    
    // Remove '/api/serve-file' from the path
    const pathParts = pathSegments.slice(3);
    
    if (pathParts.length === 0) {
      return NextResponse.json(
        { error: 'No file path specified' },
        { status: 400 }
      );
    }
    
    const filePath = join(process.cwd(), 'uploads', ...pathParts);
    
    const fileBuffer = await readFile(filePath)
    
    const response = new NextResponse(fileBuffer)
    response.headers.set('Content-Type', 'audio/wav')
    return response
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
} 