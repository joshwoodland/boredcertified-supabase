/**
 * Server configuration utility
 * 
 * This utility provides access to server-side configuration values
 * that are not exposed to the client.
 */

import getConfig from 'next/config';

/**
 * Get server runtime configuration
 * 
 * @returns The server runtime configuration object
 */
export function getServerConfig() {
  // Get the server runtime config
  const { serverRuntimeConfig } = getConfig() || { serverRuntimeConfig: {} };
  return serverRuntimeConfig;
}
