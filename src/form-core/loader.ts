/**
 * Load form-v2 core from the esbuild bundle (see scripts/bundle-form-core.mjs).
 */

import { parseHTML } from 'linkedom';

export interface FormCore {
  compileSchema: (schema: unknown) => unknown;
  validateAgainst: (schema: unknown, data: unknown) => unknown;
  json2html: (doc: unknown) => string;
}

let formCorePromise: Promise<FormCore> | null = null;

function setupDocument(): void {
  // form-core json2html expects browser DOM APIs (document/createElement/querySelector)
  // including document.implementation.createHTMLDocument(), which Workers don't provide.
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  Object.assign(document, {
    implementation: {
      createHTMLDocument: () =>
        parseHTML('<!DOCTYPE html><html><body></body></html>').document,
    },
  });
  globalThis.document = document;
}

async function loadFormCore(): Promise<FormCore> {
  setupDocument();
  const { compileSchema, validateAgainst, json2html } = await import('./bundled.js');
  return { compileSchema, validateAgainst, json2html };
}

export function getFormCore(): Promise<FormCore> {
  if (!formCorePromise) {
    formCorePromise = loadFormCore().catch((error) => {
      // Allow a retry on the next request if first initialization failed.
      formCorePromise = null;
      throw error;
    });
  }
  return formCorePromise;
}
