import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { readFile, access, constants } from 'fs/promises'
import { existsSync } from 'fs'

// Simplified handler with a clearer signature
export const dynamic = 'force-dynamic'; // Disable caching for this route

export async function GET(
  request: NextRequest
) {
  try {
    // Extract the path from the URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');

    console.log('Request URL:', url.toString());
    console.log('Path segments:', pathSegments);

    // Remove '/api/serve-file' from the path
    const pathParts = pathSegments.slice(3);
    console.log('Path parts after slice:', pathParts);

    if (pathParts.length === 0) {
      return NextResponse.json(
        { error: 'No file path specified' },
        { status: 400 }
      );
    }

    // Handle URL-encoded filenames
    const decodedPathParts = pathParts.map(part => decodeURIComponent(part));
    console.log('Decoded path parts:', decodedPathParts);

    const filePath = join(process.cwd(), 'uploads', ...decodedPathParts);
    console.log('Full file path:', filePath);

    // Check if file exists before trying to read it
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return NextResponse.json(
        { error: 'File not found on server' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);
    console.log(`Successfully read file: ${filePath}, size: ${fileBuffer.length} bytes`);

    // Determine the content type based on file extension
    let contentType = 'application/octet-stream';
    const fileName = decodedPathParts[decodedPathParts.length - 1].toLowerCase();

    if (fileName.endsWith('.wav')) {
      contentType = 'audio/wav';
    } else if (fileName.endsWith('.mp3')) {
      contentType = 'audio/mpeg';
    } else if (fileName.endsWith('.m4a')) {
      contentType = 'audio/mp4';
    } else if (fileName.endsWith('.ogg')) {
      contentType = 'audio/ogg';
    } else if (fileName.endsWith('.webm')) {
      contentType = 'audio/webm';
    }

    console.log(`Serving file: ${fileName} with content type: ${contentType}`);

    // Create response with proper headers
    const response = new NextResponse(fileBuffer);
    response.headers.set('Content-Type', contentType);
    response.headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}