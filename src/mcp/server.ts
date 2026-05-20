/**
 * MCP Server Setup — DA Structured Content tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { FormCore } from '../form-core/loader';
import {
  handleCompileSchema,
  handleValidateDocument,
  handleSerializeSchema,
  handleSerializeDocument,
  handleGetEditorUrls,
} from './handlers';

export function createServer(formCore: FormCore, version: string): McpServer {
  const server = new McpServer({ name: 'da-sc', version });

  server.registerTool(
    'sc_compile_schema',
    {
      description:
        'Compile and validate a JSON Schema against the DA form spec. Returns { editable, issues } — issues is an array of objects with pointer, reason, feature fields. reason codes: unsupported-composition, unsupported-type, type-as-array, missing-type, external-ref, unresolved-ref.',
      inputSchema: z.object({
        schema: z.string().describe('JSON Schema as a JSON string'),
      }),
    },
    (args) => handleCompileSchema(formCore, args) as Promise<CallToolResult>,
  );

  server.registerTool(
    'sc_validate_document',
    {
      description:
        'Validate form document data against a schema. Returns { errorsByPointer } where keys are RFC 6901 JSON Pointers (/data/fieldName) and values are human-readable error messages.',
      inputSchema: z.object({
        schema: z.string().describe('JSON Schema as a JSON string'),
        data: z
          .string()
          .describe(
            'The data object to validate, as a JSON string (the .data property of the form document)',
          ),
      }),
    },
    (args) => handleValidateDocument(formCore, args) as Promise<CallToolResult>,
  );

  server.registerTool(
    'sc_serialize_schema',
    {
      description:
        'Serialize a JSON Schema into the DA HTML shell used by the schema-editor block. The result is the content to pass to da_create_source when saving a schema at /.da/forms/schemas/{name}.html.',
      inputSchema: z.object({
        schema: z
          .string()
          .describe('JSON Schema as a JSON string — will be pretty-printed inside the HTML'),
      }),
    },
    (args) => handleSerializeSchema(args) as Promise<CallToolResult>,
  );

  server.registerTool(
    'sc_serialize_document',
    {
      description:
        'Convert a form document { metadata, data } to DA EDS HTML using the same serialiser the form block uses on save. metadata MUST include schemaName AND title — the call will be rejected with an error if either is absent or empty. Returns the HTML string to pass to da_create_source.',
      inputSchema: z.object({
        document: z
          .string()
          .describe(
            'Form document as a JSON string: { "metadata": { "schemaName": "...", "title": "..." }, "data": { ... } }',
          ),
      }),
    },
    (args) => handleSerializeDocument(formCore, args) as Promise<CallToolResult>,
  );

  server.registerTool(
    'sc_get_editor_urls',
    {
      description:
        'Return the correct DA editor URLs for a schema and (optionally) a document. Always use this tool to get links — never construct DA URLs manually.',
      inputSchema: z.object({
        org: z.string().describe('DA org'),
        site: z.string().describe('DA site'),
        docPath: z
          .string()
          .optional()
          .describe(
            'Document path without .html extension, e.g. /forms/my-product. Omit to get the schema editor URL only.',
          ),
      }),
    },
    (args) => handleGetEditorUrls(args) as Promise<CallToolResult>,
  );

  return server;
}
