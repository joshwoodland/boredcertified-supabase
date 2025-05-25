import { DeepgramError, createClient } from "@deepgram/sdk";
import { NextResponse, type NextRequest } from "next/server";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check if we're in a development environment
    // This includes: npm run dev, vercel dev, or explicit development flag
    const isLocalDevelopment = 
      process.env.NODE_ENV === "development" || 
      process.env.DEEPGRAM_ENV === "development" ||
      process.env.VERCEL_ENV === "development" ||
      (!process.env.VERCEL_ENV && !process.env.VERCEL) || // Local development without Vercel
      process.env.VERCEL_URL?.includes('localhost') ||
      request.url.includes('localhost');

    console.log('[DEEPGRAM AUTH] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      DEEPGRAM_ENV: process.env.DEEPGRAM_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_URL: process.env.VERCEL_URL,
      requestUrl: request.url,
      isLocalDevelopment
    });

    // For development environments, return the API key directly
    if (isLocalDevelopment) {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        console.error('[DEEPGRAM AUTH] Missing DEEPGRAM_API_KEY in development');
        return NextResponse.json(
          { error: "Deepgram API key not configured" },
          { status: 500 }
        );
      }
      
      console.log('[DEEPGRAM AUTH] Using direct API key for development environment');
      return NextResponse.json({
        key: apiKey,
      });
    }

    // For production, create temporary keys
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");

    let { result: projectsResult, error: projectsError } =
      await deepgram.manage.getProjects();

    if (projectsError) {
      console.error('[DEEPGRAM AUTH] Error getting projects:', projectsError);
      return NextResponse.json(projectsError, { status: 500 });
    }

    const project = projectsResult?.projects[0];

    if (!project) {
      return NextResponse.json(
        new DeepgramError(
          "Cannot find a Deepgram project. Please create a project first."
        ),
        { status: 404 }
      );
    }

    let { result: newKeyResult, error: newKeyError } =
      await deepgram.manage.createProjectKey(project.project_id, {
        comment: "Temporary API key for BoredCertified",
        scopes: ["usage:write"],
        tags: ["next.js", "boredcertified"],
        time_to_live_in_seconds: 3600, // 1 hour
      });

    if (newKeyError) {
      console.error('[DEEPGRAM AUTH] Error creating temporary key:', newKeyError);
      return NextResponse.json(newKeyError, { status: 500 });
    }

    console.log('[DEEPGRAM AUTH] Successfully created temporary key');

    const response = NextResponse.json({ ...newKeyResult, url: request.url });
    
    // Set cache control headers
    response.headers.set("Surrogate-Control", "no-store");
    response.headers.set(
      "Cache-Control",
      "s-maxage=0, no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error('[DEEPGRAM AUTH] Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 