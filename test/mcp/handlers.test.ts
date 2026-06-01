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
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { convertJsonToHtml, validateData, validateSchema } from '@adobe/da-sc-sdk';
import {
  handleCompileSchema,
  handleValidateDocument,
  handleSerializeSchema,
  handleSerializeDocument,
} from '../../src/mcp/handlers';

vi.mock('@adobe/da-sc-sdk', () => ({
  validateSchema: vi.fn(),
  validateData: vi.fn(),
  convertJsonToHtml: vi.fn(),
}));

const SCHEMA_HTML_SHELL = '<body><header></header><main><div><pre><code>{{JSON}}</code></pre></div></main><footer></footer></body>';

describe('sc handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('handleCompileSchema', () => {
    it('parses schema and returns compile result as pretty JSON text', async () => {
      vi.mocked(validateSchema).mockReturnValue({ valid: true, schemaIssues: [] });

      const result = await handleCompileSchema({ schema: '{"type":"object"}' });

      expect(validateSchema).toHaveBeenCalledWith({ schema: { type: 'object' } });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(
        JSON.stringify({ valid: true, schemaIssues: [] }, null, 2),
      );
    });

    it('returns error payload when schema JSON cannot be parsed', async () => {
      const result = await handleCompileSchema({ schema: '{bad' });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.error).toBeDefined();
    });
  });

  describe('handleValidateDocument', () => {
    it('maps SDK validation errors to errorsByPointer messages', async () => {
      vi.mocked(validateData).mockReturnValue({
        valid: false,
        errors: {
          '/data/name': {
            keyword: 'required',
            instancePath: '/data/name',
            params: { missingProperty: 'name' },
            message: 'This field is required.',
          },
        },
        schemaIssues: [],
      });

      const result = await handleValidateDocument({
        schema: '{"type":"object"}',
        data: '{"name":"x"}',
      });

      expect(validateData).toHaveBeenCalledWith({ schema: { type: 'object' }, data: { name: 'x' } });
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify({
        errorsByPointer: {
          '/data/name': 'This field is required.',
        },
      }, null, 2));
    });

    it('returns error payload when data JSON cannot be parsed', async () => {
      const result = await handleValidateDocument({
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
      const result = await handleSerializeDocument({
        document: JSON.stringify({ metadata: { title: 'Title' }, data: {} }),
      });

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual({ error: 'metadata.schemaName is required' });
    });

    it('returns error when metadata.title is missing or blank', async () => {
      const result = await handleSerializeDocument({
        document: JSON.stringify({ metadata: { schemaName: 'my-schema', title: '   ' }, data: {} }),
      });

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toContain('metadata.title is required');
    });

    it('serializes valid document with convertJsonToHtml', async () => {
      const doc = { metadata: { schemaName: 'my-schema', title: 'Hello' }, data: { name: 'x' } };
      vi.mocked(convertJsonToHtml).mockReturnValue({ html: '<body>ok</body>' });

      const result = await handleSerializeDocument({ document: JSON.stringify(doc) });

      expect(convertJsonToHtml).toHaveBeenCalledWith({ json: doc });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('<body>ok</body>');
    });

    it('returns error when convertJsonToHtml fails', async () => {
      vi.mocked(convertJsonToHtml).mockReturnValue({ error: 'Invalid JSON payload.' });

      const result = await handleSerializeDocument({
        document: JSON.stringify({ metadata: { schemaName: 'my-schema', title: 'Hello' }, data: {} }),
      });

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual({ error: 'Invalid JSON payload.' });
    });
  });
});
