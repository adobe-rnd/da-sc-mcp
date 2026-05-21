/**
 * MCP Tool Handlers — DA Structured Content (form-v2 core)
 */

import type { FormCore } from '../form-core/loader';

// Matches schema-editor/utils/utils.js HTML_SHELL exactly.
const SCHEMA_HTML_SHELL =
  '<body><header></header><main><div><pre><code>{{JSON}}</code></pre></div></main><footer></footer></body>';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function handleCompileSchema(
  formCore: FormCore,
  args: { schema: string },
) {
  try {
    const result = formCore.compileSchema(JSON.parse(args.schema));
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage(err) }) }] };
  }
}

export async function handleValidateDocument(
  formCore: FormCore,
  args: { schema: string; data: string },
) {
  try {
    const result = formCore.validateAgainst(JSON.parse(args.schema), JSON.parse(args.data));
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

export async function handleSerializeDocument(
  formCore: FormCore,
  args: { document: string },
) {
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

    const html = formCore.json2html(doc);
    return { content: [{ type: 'text' as const, text: html }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage(err) }) }],
    };
  }
}
