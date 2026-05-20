/**
 * Bundle form-v2 core from AEM at build time (Workers cannot dynamic-import remote/data modules).
 */

import * as esbuild from 'esbuild';
import {
  existsSync, readFileSync, writeFileSync,
} from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** AEM preview for da-nx form-v2; rebundle after remote core changes. */
const FORM_CORE_BASE = 'https://form-v2--da-nx--adobe.aem.page';
const LOCK_MODE = process.env.FORM_CORE_LOCK_MODE ?? 'check';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/form-core/bundled.js');
const lockPath = join(root, 'src/form-core/bundle-lock.json');
const loadedModuleHashes = new Map();

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function toSortedObject(entries) {
  return Object.fromEntries(
    [...entries].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function writeIfChanged(path, contents) {
  if (existsSync(path)) {
    const current = readFileSync(path, 'utf8');
    if (current === contents) {
      return false;
    }
  }

  writeFileSync(path, contents);
  return true;
}

function syncBundleLock() {
  const current = {
    formCoreBase: FORM_CORE_BASE,
    modules: toSortedObject(loadedModuleHashes.entries()),
  };
  const lockContent = `${JSON.stringify(current, null, 2)}
`;

  if (LOCK_MODE === 'update') {
    if (writeIfChanged(lockPath, lockContent)) {
      console.log(`Updated ${lockPath}`);
    } else {
      console.log(`Lock unchanged at ${lockPath}`);
    }
    return;
  }

  if (!existsSync(lockPath)) {
    throw new Error(
      `Missing lock file at ${lockPath}. Run "npm run bundle:update-lock" to create it.`,
    );
  }

  const expected = JSON.parse(readFileSync(lockPath, 'utf8'));
  const drift = [];

  if (expected.formCoreBase !== current.formCoreBase) {
    drift.push(
      `formCoreBase changed: expected "${expected.formCoreBase}", got "${current.formCoreBase}"`,
    );
  }

  const expectedModules = expected.modules ?? {};
  const currentModules = current.modules;
  const allUrls = new Set([...Object.keys(expectedModules), ...Object.keys(currentModules)]);

  for (const url of allUrls) {
    if (!expectedModules[url]) {
      drift.push(`New module detected: ${url}`);
      continue;
    }
    if (!currentModules[url]) {
      drift.push(`Missing module: ${url}`);
      continue;
    }
    if (expectedModules[url] !== currentModules[url]) {
      drift.push(`Content changed: ${url}`);
    }
  }

  if (drift.length) {
    throw new Error(
      `form-core drift detected against ${lockPath}
${drift.join('\n')}\n\n`
      + 'If this update is intentional, run "npm run bundle:update-lock" and commit the lock file.',
    );
  }
}

const httpsPlugin = {
  name: 'https',
  setup(build) {
    build.onResolve({ filter: /^https:\/\// }, (args) => ({
      path: args.path,
      namespace: 'https',
    }));

    build.onResolve({ filter: /^\./, namespace: 'https' }, (args) => ({
      path: new URL(args.path, args.importer).href,
      namespace: 'https',
    }));

    build.onLoad({ filter: /.*/, namespace: 'https' }, async (args) => {
      const res = await fetch(args.path);
      if (!res.ok) throw new Error(`fetch ${args.path} → ${res.status}`);
      const contents = await res.text();
      loadedModuleHashes.set(args.path, sha256(contents));
      return { contents, loader: 'js' };
    });
  },
};

const entrySource = `export { compileSchema } from '${FORM_CORE_BASE}/nx/blocks/form/core/schema.js';
export { validateAgainst } from '${FORM_CORE_BASE}/nx/blocks/form/core/index.js';
export { default as json2html } from '${FORM_CORE_BASE}/nx/blocks/form/app/json2html.js';
`;

const buildResult = await esbuild.build({
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: outPath,
  write: false,
  stdin: {
    contents: entrySource,
    sourcefile: 'form-core-entry.mjs',
    resolveDir: root,
    loader: 'js',
  },
  plugins: [httpsPlugin],
  logLevel: 'info',
});

const bundleOutput = buildResult.outputFiles?.find((file) => file.path.endsWith('bundled.js'))
  ?? buildResult.outputFiles?.[0];
if (!bundleOutput) {
  throw new Error('esbuild did not produce bundled.js output');
}

const wroteBundle = writeIfChanged(outPath, bundleOutput.text);

syncBundleLock();
if (wroteBundle) {
  console.log(`Wrote ${outPath}`);
} else {
  console.log(`Bundle unchanged at ${outPath}`);
}
