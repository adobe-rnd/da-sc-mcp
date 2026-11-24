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

import { describe, expect, it } from 'vitest';
import { convertJsonToHtml, createEngine } from '@adobe/da-sc-sdk';
import type { Document, Model } from '@adobe/da-sc-sdk';
import {
  handleCompileSchema,
  handleValidateDocument,
  handleValidateHtml,
  handleSerializeDocument,
} from '../../src/mcp/handlers';

function parseJsonContent(text: string) {
  return JSON.parse(text) as Record<string, unknown>;
}

describe('sc handlers integration (real sdk)', () => {
  it('compiles a simple schema with no issues', async () => {
    const result = await handleCompileSchema({
      schema: JSON.stringify({
        type: 'object',
        properties: { name: { type: 'string' } },
      }),
    });

    expect(result.content[0].type).toBe('text');

    const payload = parseJsonContent(result.content[0].text);
    expect(payload.valid).toBe(true);
    expect(payload.schemaIssues).toEqual([]);
  });

  it('reports schema issues for unsupported composition keywords', async () => {
    const result = await handleCompileSchema({
      schema: JSON.stringify({
        oneOf: [
          {
            type: 'object',
            properties: {
              kind: { type: 'string' },
            },
          },
          {
            type: 'object',
            properties: {
              value: { type: 'number' },
            },
          },
        ],
      }),
    });

    expect(result.content[0].type).toBe('text');

    const payload = parseJsonContent(result.content[0].text);
    expect(payload.valid).toBe(false);
    expect(Array.isArray(payload.schemaIssues)).toBe(true);
    expect((payload.schemaIssues as unknown[]).length).toBeGreaterThan(0);

    // da-sc-sdk 0.3 shape: { reason, message, schemaPath, pointer, details }
    const [issue] = payload.schemaIssues as Array<Record<string, unknown>>;
    expect(typeof issue.reason).toBe('string');
    expect(typeof issue.message).toBe('string');
    expect(typeof issue.schemaPath).toBe('string');
    expect(typeof issue.pointer).toBe('string');
  });

  it('returns pointer-based errors from real data validation', async () => {
    const result = await handleValidateDocument({
      schema: JSON.stringify({
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      }),
      data: JSON.stringify({}),
    });

    expect(result.content[0].type).toBe('text');

    const payload = parseJsonContent(result.content[0].text);
    expect(payload.errorsByPointer).toBeTypeOf('object');
    expect((payload.errorsByPointer as Record<string, string>)['/data/name']).toBeTypeOf('string');
  });

  it('returns multiple pointer errors for nested invalid data', async () => {
    const result = await handleValidateDocument({
      schema: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 3 },
          profile: {
            type: 'object',
            properties: {
              age: { type: 'number', minimum: 18 },
              tags: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
              },
            },
            required: ['age', 'tags'],
          },
        },
        required: ['name', 'profile'],
      }),
      data: JSON.stringify({
        name: 'Al',
        profile: {
          age: 15,
          tags: [],
        },
      }),
    });

    expect(result.content[0].type).toBe('text');

    const payload = parseJsonContent(result.content[0].text);
    const errorsByPointer = payload.errorsByPointer as Record<string, string>;
    const pointers = Object.keys(errorsByPointer);

    expect(pointers.length).toBeGreaterThanOrEqual(2);
    expect(errorsByPointer['/data/name']).toBeTypeOf('string');
    expect(pointers.some((pointer) => pointer.startsWith('/data/profile'))).toBe(true);
  });

  it('serializes a valid document into html', async () => {
    const result = await handleSerializeDocument({
      document: JSON.stringify({
        metadata: {
          schemaName: 'integration-schema',
          title: 'Integration Title',
        },
        data: {
          name: 'Ada',
        },
      }),
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('<body>');
    expect(result.content[0].text).toContain('integration-schema');
    expect(result.content[0].text).toContain('Integration Title');
    expect(result.content[0].text).toContain('Ada');
  });

  it('serializes a richer document payload into html', async () => {
    const result = await handleSerializeDocument({
      document: JSON.stringify({
        metadata: {
          schemaName: 'employee-profile',
          title: 'Advanced Integration Title',
          locale: 'en-US',
        },
        data: {
          name: 'Ada Lovelace',
          location: {
            city: 'London',
            country: 'UK',
          },
          skills: ['math', 'analysis'],
        },
      }),
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('<body>');
    expect(result.content[0].text).toContain('employee-profile');
    expect(result.content[0].text).toContain('Advanced Integration Title');
    expect(result.content[0].text).toContain('Ada Lovelace');
    expect(result.content[0].text).toContain('London');
  });

  describe('document schema', () => {
    // rich-text makes the model's effect visible as a self:// reference in the HTML.
    const schema = {
      type: 'object',
      properties: { body: { type: 'string', 'x-semantic-type': 'rich-text' } },
    };
    const document = (body: unknown) => JSON.stringify({
      metadata: { schemaName: 'article', title: 'Article' },
      data: { body },
    });

    it('serializes a rich-text value with the model built from the schema', async () => {
      const result = await handleSerializeDocument({
        document: document('<p>Hi</p>'),
        schema: JSON.stringify(schema),
      });

      expect(result.isError).toBeUndefined();
      const html = result.content[0].text;
      expect(html).toContain('<p>self://rich-text#body-1</p>');
      expect(html).toContain('<div class="body body-1"><div><div><p>Hi</p></div></div></div>');
    });

    it('serializes without a model when no schema is given', async () => {
      const result = await handleSerializeDocument({ document: document('<p>Hi</p>') });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).not.toContain('self://');
    });

    it('returns the SDK error when the data does not fit the schema', async () => {
      const result = await handleSerializeDocument({
        document: document(42),
        schema: JSON.stringify(schema),
      });

      expect(result.isError).toBe(true);
      expect(parseJsonContent(result.content[0].text).error).toBeTypeOf('string');
    });
  });
});

describe('sc_validate_html (real sdk)', () => {
  const schema = {
    type: 'object',
    title: 'Store',
    properties: {
      zip: { type: 'string', title: 'ZIP code' },
      stock: { type: 'number', title: 'Stock' },
      body: { type: 'string', title: 'Body', 'x-semantic-type': 'rich-text' },
      cards: {
        type: 'array',
        title: 'Cards',
        items: {
          type: 'object',
          title: 'Card',
          properties: { name: { type: 'string', title: 'Name', minLength: 3 } },
        },
      },
    },
  };

  // Builds the HTML the way DA stores it; the editor passes its model on save.
  const storedHtml = (data: unknown, model?: Model | null) => {
    const json: Document = { metadata: { schemaName: 'store', title: 'Store' }, data };
    const serialized = convertJsonToHtml({ json, model });
    if ('error' in serialized) {
      throw new Error(serialized.error);
    }
    return serialized.html;
  };

  const validate = async (html: string, schemaText = JSON.stringify(schema)) => {
    const result = await handleValidateHtml({ schema: schemaText, html });
    return { isError: result.isError, payload: parseJsonContent(result.content[0].text) };
  };

  it('accepts a ZIP code in a text field', async () => {
    const { isError, payload } = await validate(storedHtml({ zip: '12345' }));

    expect(isError).toBeUndefined();
    expect(payload).toEqual({ valid: true, errors: [], schemaIssues: [] });
  });

  it('rejects text in a number field', async () => {
    const { payload } = await validate(storedHtml({ stock: 'many' }));

    expect(payload.valid).toBe(false);
    expect(payload.errors).toEqual([
      { pointer: '/data/stock', label: 'Stock', message: 'Must be a number.' },
    ]);
  });

  it('accepts a rich-text field stored as the editor saves it', async () => {
    const document = { metadata: { schemaName: 'store' }, data: { body: '<p>Hi <strong>there</strong></p>' } };
    const { model } = createEngine({ schema, document }).getState();
    const html = storedHtml(document.data, model);

    const { payload } = await validate(html);

    expect(html).toContain('self://rich-text#');
    expect(payload).toEqual({ valid: true, errors: [], schemaIssues: [] });
  });

  it('labels errors in a nested array with the field trail', async () => {
    const { payload } = await validate(storedHtml({ cards: [{ name: 'Alice' }, { name: 'Bo' }] }));

    expect(payload.errors).toEqual([{
      pointer: '/data/cards/1/name',
      label: 'Cards › Card 2 › Name',
      message: 'Must be at least 3 characters.',
    }]);
  });

  it('returns unsupported schema parts as labelled schema issues', async () => {
    const withOneOf = {
      ...schema,
      properties: {
        ...schema.properties,
        price: { title: 'Price', oneOf: [{ type: 'string' }, { type: 'number' }] },
      },
    };

    const { payload } = await validate(storedHtml({ zip: '12345' }), JSON.stringify(withOneOf));

    expect(payload.valid).toBe(false);
    expect(payload.errors).toEqual([]);
    expect(payload.schemaIssues).toEqual([expect.objectContaining({
      reason: 'unsupported-composition',
      pointer: '/data/price',
      label: 'Price',
    })]);
  });

  it('fails on invalid schema JSON', async () => {
    const { isError, payload } = await validate(storedHtml({ zip: '12345' }), '{bad');

    expect(isError).toBe(true);
    expect(payload.error).toBeTypeOf('string');
  });

  it('fails on HTML without a form block', async () => {
    const { isError, payload } = await validate('<body><main><div><p>Hello</p></div></main></body>');

    expect(isError).toBe(true);
    expect(payload.error).toContain('not a structured content document');
  });
});
