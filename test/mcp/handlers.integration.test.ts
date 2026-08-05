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
import {
  handleCompileSchema,
  handleValidateDocument,
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
});
