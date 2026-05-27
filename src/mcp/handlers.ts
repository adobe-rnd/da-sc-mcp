/**
 * MCP Tool Handlers — DA Structured Content
 */

import { convertJsonToHtml, validateData, validateSchema } from 'da-sc-sdk';
import type { Document, ValidationError } from 'da-sc-sdk';

// Matches schema-editor/utils/utils.js HTML_SHELL exactly.
const SCHEMA_HTML_SHELL =
  '<body><header></header><main><div><pre><code>{{JSON}}</code></pre></div></main><footer></footer></body>';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mapValidationErrors(errors: Record<string, ValidationError>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([pointer, error]) => [pointer, error.message]),
  );
}

export async function handleCompileSchema(args: { schema: string }) {
  try {
    const { valid, schemaIssues } = validateSchema({ schema: JSON.parse(args.schema) });
    return { content: [{ type: 'text' as const, text: JSON.stringify({ valid, schemaIssues }, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage(err) }) }] };
  }
}

export async function handleValidateDocument(args: { schema: string; data: string }) {
  try {
    const { errors } = validateData({
      schema: JSON.parse(args.schema),
      data: JSON.parse(args.data),
    });
    const result = {
      errorsByPointer: mapValidationErrors(errors),
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage(err) }) }] };
  }
}

export async function handleSerializeSchema(args: { schema: string }) {
  try {
    const pretty = JSON.stringify(JSON.parse(args.schema), null, 2);
    const html = SCHEMA_HTML_SHELL.replace('{{JSON}}', pretty);
    return { content: [{ type: 'text' as const, text: html }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage(err) }) }] };
  }
}

export async function handleSerializeDocument(args: { document: string }) {
  try {
    const doc = JSON.parse(args.document) as {
      metadata?: { schemaName?: string; title?: string };
      data?: unknown;
    };

    if (!doc.metadata?.schemaName) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'metadata.schemaName is required' }) }],
      };
    }
    if (!doc.metadata?.title || String(doc.metadata.title).trim() === '') {
      return {
        isError: true,
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error:
              'metadata.title is required. Provide a descriptive human-readable title — DA uses it as the page title and the form editor will not display the document correctly without it. Add "title" to metadata and retry.',
          }),
        }],
      };
    }

    const serialized = convertJsonToHtml({ json: doc as Document });
    if ('error' in serialized) {
      throw new Error(serialized.error);
    }
    return { content: [{ type: 'text' as const, text: serialized.html }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage(err) }) }],
    };
  }
}
