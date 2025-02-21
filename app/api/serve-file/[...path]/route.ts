import { NextResponse } from 'next/server'
import { join } from 'path'
import { readFile } from 'fs/promises'

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = join(process.cwd(), 'uploads', ...params.path)
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