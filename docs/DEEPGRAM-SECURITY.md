# Deepgram API Security Guide

This document explains the secure implementation of Deepgram API integration in the BoredCertified application.

## Security Best Practices

### ✅ DO: Use server-side API routes

The application uses secure server-side API routes to interact with the Deepgram API:

- `/api/deepgram/token` - Generates temporary tokens for client-side use
- `/api/deepgram/websocket` - Provides WebSocket connection details

This approach keeps the API key secure on the server and never exposes it to the client.

### ❌ DON'T: Use NEXT_PUBLIC_DEEPGRAM_API_KEY

Never use `NEXT_PUBLIC_DEEPGRAM_API_KEY` in your environment variables. This would expose the API key to the client, creating a security vulnerability.

## Environment Variables

Set up your environment variables correctly:

```
# .env.local
# CORRECT: Server-side only (not exposed to client)
DEEPGRAM_API_KEY=your_api_key_here

# INCORRECT: Do NOT use this!
# NEXT_PUBLIC_DEEPGRAM_API_KEY=your_api_key_here
```

## Troubleshooting

If you see errors related to `NEXT_PUBLIC_DEEPGRAM_API_KEY` in the browser console:

1. Make sure you're using the latest version of the codebase
2. Check your environment variables and remove any `NEXT_PUBLIC_DEEPGRAM_API_KEY`
3. Run the clean build script to remove any old build artifacts:

```bash
npm run clean-build
```

## How the Secure Implementation Works

1. **Server-side API Key Storage**: The Deepgram API key is stored as `DEEPGRAM_API_KEY` in environment variables and is only accessible on the server.

2. **Temporary Token Generation**: The `/api/deepgram/token` endpoint generates short-lived tokens using the Deepgram API, which are then used by the client.

3. **WebSocket Connection**: The client uses these temporary tokens to establish WebSocket connections directly with Deepgram.

4. **Security Monitoring**: The application includes security checks to detect and warn about any attempts to use the insecure pattern.

## Security Checks

The application includes several security features:

1. **Runtime Checks**: Monitors for any attempts to access `NEXT_PUBLIC_DEEPGRAM_API_KEY`
2. **Warning Messages**: Displays clear error messages if insecure patterns are detected
3. **Console Logging**: Logs detailed information about security violations

## Vercel Deployment

When deploying to Vercel:

1. Add `DEEPGRAM_API_KEY` as an environment variable in the Vercel project settings
2. Do NOT add any environment variables with the `NEXT_PUBLIC_` prefix for API keys
3. Ensure the API key has the necessary permissions (Speech, Admin)

## Additional Resources

- [Deepgram API Documentation](https://developers.deepgram.com/docs/)
- [Next.js API Routes Documentation](https://nextjs.org/docs/api-routes/introduction)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
