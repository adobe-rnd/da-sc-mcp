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
import {
  convertHtmlToJson, convertJsonToHtml, createEngine, validateData, validateSchema,
} from '@adobe/da-sc-sdk';
import type {
  EditorState, Engine, Model, ModelNode,
} from '@adobe/da-sc-sdk';
import {
  handleCompileSchema,
  handleValidateDocument,
  handleValidateHtml,
  handleSerializeSchema,
  handleSerializeDocument,
} from '../../src/mcp/handlers';

vi.mock('@adobe/da-sc-sdk', () => ({
  validateSchema: vi.fn(),
  validateData: vi.fn(),
  convertJsonToHtml: vi.fn(),
  convertHtmlToJson: vi.fn(),
  createEngine: vi.fn(),
}));

function mockEngineState(state: Partial<EditorState>) {
  vi.mocked(createEngine).mockReturnValue({
    getState: () => ({
      document: null, model: null, validation: { errors: {} }, schemaIssues: [], ...state,
    }),
  } as unknown as Engine);
}

function mockEngineModel(model: Model) {
  mockEngineState({ model });
}

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

  describe('handleValidateHtml', () => {
    const json = { metadata: { schemaName: 'article' }, data: {} };
    const node = (pointer: string, label: string, extra: Partial<ModelNode> = {}) => (
      { pointer, label, ...extra } as ModelNode
    );
    const model = {
      root: node('/data', 'Article', {
        children: [
          node('/data/title', 'Title'),
          node('/data/cards', 'Cards', {
            items: [node('/data/cards/0', 'Card', { children: [node('/data/cards/0/name', 'Name')] })],
          }),
        ],
      }),
    } as Model;
    const validate = () => handleValidateHtml({ schema: '{"type":"object"}', html: '<body></body>' });
    const error = (message: string) => ({
      keyword: 'type', instancePath: '', params: {}, message,
    });

    it('labels errors and schema issues and lists errors in document order', async () => {
      vi.mocked(convertHtmlToJson).mockReturnValue({ json });
      const issue = {
        reason: 'unsupported-composition' as const,
        message: 'Composition "oneOf" is not supported.',
        schemaPath: '/properties/title',
        pointer: '/data/title',
        details: null,
      };
      mockEngineState({
        model,
        validation: {
          errors: {
            '/data/cards/0/name': error('Must be a string.'),
            '/data/extra': error('Must not be present.'),
            '/data/title': error('This field is required.'),
          },
        },
        schemaIssues: [issue],
      });

      const result = await validate();

      expect(convertHtmlToJson).toHaveBeenCalledWith({ html: '<body></body>' });
      expect(createEngine).toHaveBeenCalledWith({ schema: { type: 'object' }, document: json });
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual({
        valid: false,
        errors: [
          { pointer: '/data/title', label: 'Title', message: 'This field is required.' },
          { pointer: '/data/cards/0/name', label: 'Cards › Card 1 › Name', message: 'Must be a string.' },
          { pointer: '/data/extra', label: '/data/extra', message: 'Must not be present.' },
        ],
        schemaIssues: [{ ...issue, label: 'Title' }],
      });
    });

    it('is valid without errors and schema issues', async () => {
      vi.mocked(convertHtmlToJson).mockReturnValue({ json });
      mockEngineState({ model });

      const result = await validate();

      expect(JSON.parse(result.content[0].text)).toEqual({
        valid: true, errors: [], schemaIssues: [],
      });
    });

    it('fails when the HTML cannot be converted', async () => {
      vi.mocked(convertHtmlToJson).mockReturnValue({ error: 'html must be a non-empty string.' });

      const result = await validate();

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual({ error: 'html must be a non-empty string.' });
      expect(createEngine).not.toHaveBeenCalled();
    });

    it('fails when the HTML has no schema name', async () => {
      vi.mocked(convertHtmlToJson).mockReturnValue({ json: { metadata: {}, data: {} } as never });

      const result = await validate();

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text).error).toContain('not a structured content document');
      expect(createEngine).not.toHaveBeenCalled();
    });

    it('fails when the engine builds no model from the schema', async () => {
      vi.mocked(convertHtmlToJson).mockReturnValue({ json });
      mockEngineState({ model: null });

      const result = await validate();

      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual({ error: 'The schema must be a JSON object.' });
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
      expect(createEngine).not.toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('<body>ok</body>');
    });

    it('passes the model built from the schema to convertJsonToHtml', async () => {
      const doc = { metadata: { schemaName: 'my-schema', title: 'Hello' }, data: { name: 'x' } };
      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const model = { root: {}, byPointer: {}, document: doc } as unknown as Model;
      mockEngineModel(model);
      vi.mocked(convertJsonToHtml).mockReturnValue({ html: '<body>ok</body>' });

      const result = await handleSerializeDocument({
        document: JSON.stringify(doc),
        schema: JSON.stringify(schema),
      });

      expect(createEngine).toHaveBeenCalledWith({ schema, document: doc });
      expect(convertJsonToHtml).toHaveBeenCalledWith({ json: doc, model });
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
