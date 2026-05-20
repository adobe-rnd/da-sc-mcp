/**
 * Cloudflare Worker Entry Point — da-sc-mcp
 */

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { getFormCore } from './form-core/loader';
import { createServer } from './mcp/server';

export interface Env {
  ENVIRONMENT?: string;
  VERSION?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
};

function handleHealthCheck(env: Env): Response {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'da-sc-mcp',
      version: env.VERSION,
      environment: env.ENVIRONMENT || 'development',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return handleHealthCheck(env);
    }

    if (request.method === 'GET') {
      return new Response(null, {
        status: 405,
        headers: { Allow: 'POST, DELETE, OPTIONS', ...CORS_HEADERS },
      });
    }

    const formCore = await getFormCore();
    const server = createServer(formCore, env.VERSION ?? '0.1.0');

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);

    const mcpResponse = await transport.handleRequest(request);

    const headers = new Headers(mcpResponse.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value);
    }
    return new Response(mcpResponse.body, { status: mcpResponse.status, headers });
  },
};
