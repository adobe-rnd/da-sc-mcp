/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  handleCompileSchema,
  handleValidateDocument,
  handleSerializeSchema,
  handleSerializeDocument,
} from './handlers';

export function createServer(version: string): McpServer {
  const server = new McpServer({ name: 'da-sc', version });

  server.registerTool(
    'sc_compile_schema',
    {
      description:
        'Compile and validate a JSON Schema against the DA form spec. Returns { valid, schemaIssues } — schemaIssues is an array of objects with reason, message, schemaPath, pointer, details fields (reason = machine code, message = human summary, schemaPath = where to fix it in the schema, pointer = data-instance location, details = reason-specific context). valid is true iff schemaIssues is empty. reason codes: unsupported-composition, unsupported-type, type-as-array, missing-type, external-ref, unresolved-ref, invalid-pattern.',
      inputSchema: z.object({
        schema: z.string().describe('JSON Schema as a JSON string'),
      }),
    },
    (args) => handleCompileSchema(args) as Promise<CallToolResult>,
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
    (args) => handleValidateDocument(args) as Promise<CallToolResult>,
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
    (args) => handleSerializeDocument(args) as Promise<CallToolResult>,
  );

  return server;
}
