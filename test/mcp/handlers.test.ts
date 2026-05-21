import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  handleCompileSchema,
  handleValidateDocument,
  handleSerializeSchema,
  handleSerializeDocument,
} from '../../src/mcp/handlers';

const SCHEMA_HTML_SHELL = '<body><header></header><main><div><pre><code>{{JSON}}</code></pre></div></main><footer></footer></body>';

function createFormCoreMock() {
  return {
    compileSchema: vi.fn((schema: unknown): unknown => ({ schema })),
    validateAgainst: vi.fn((schema: unknown, data: unknown): unknown => ({ schema, data })),
    json2html: vi.fn(() => '<body>serialized</body>'),
  };
}

describe('sc handlers', () => {
  let formCore: ReturnType<typeof createFormCoreMock>;

  beforeEach(() => {
    formCore = createFormCoreMock();
  });

  describe('handleCompileSchema', () => {
    it('parses schema and returns compile result as pretty JSON text', async () => {
      formCore.compileSchema.mockReturnValue({ editable: true, issues: [] });

      const result = await handleCompileSchema(formCore, { schema: '{"type":"object"}' });

      expect(formCore.compileSchema).toHaveBeenCalledWith({ type: 'object' });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify({ editable: true, issues: [] }, null, 2));
    });

    it('returns error payload when schema JSON cannot be parsed', async () => {
      const result = await handleCompileSchema(formCore, { schema: '{bad' });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.error).toBeDefined();
    });
  });

  describe('handleValidateDocument', () => {
    it('parses inputs and returns validate result as pretty JSON text', async () => {
      formCore.validateAgainst.mockReturnValue({ errorsByPointer: {} });

      const result = await handleValidateDocument(formCore, {
        schema: '{"type":"object"}',
        data: '{"name":"x"}',
      });

      expect(formCore.validateAgainst).toHaveBeenCalledWith({ type: 'object' }, { name: 'x' });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify({ errorsByPointer: {} }, null, 2));
    });

    it('returns error payload when data JSON cannot be parsed', async () => {
      const result = await handleValidateDocument(formCore, {
        schema: '{"type":"object"}',
        data: '{bad',
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.error).toBeDefined();
    });
  });

  describe('handleSerializeSchema', () => {
    it('serializes schema JSON into DA schema html shell', async () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const pretty = JSON.stringify(schema, null, 2);

      const result = await handleSerializeSchema({ schema: JSON.stringify(schema) });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(SCHEMA_HTML_SHELL.replace('{{JSON}}', pretty));
    });

    it('returns error payload on invalid schema JSON', async () => {
      const result = await handleSerializeSchema({ schema: '{bad' });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.error).toBeDefined();
    });
  });

  describe('handleSerializeDocument', () => {
    it('returns error when metadata.schemaName is missing', async () => {
      const result = await handleSerializeDocument(formCore, {
        document: JSON.stringify({ metadata: { title: 'Title' }, data: {} }),
      });

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual({ error: 'metadata.schemaName is required' });
    });

    it('returns error when metadata.title is missing or blank', async () => {
      const result = await handleSerializeDocument(formCore, {
        document: JSON.stringify({ metadata: { schemaName: 'my-schema', title: '   ' }, data: {} }),
      });

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toContain('metadata.title is required');
    });

    it('serializes valid document with json2html', async () => {
      const doc = { metadata: { schemaName: 'my-schema', title: 'Hello' }, data: { name: 'x' } };
      formCore.json2html.mockReturnValue('<body>ok</body>');

      const result = await handleSerializeDocument(formCore, { document: JSON.stringify(doc) });

      expect(formCore.json2html).toHaveBeenCalledWith(doc);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('<body>ok</body>');
    });
  });

});
