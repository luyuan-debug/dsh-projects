import { access, mkdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

export function profileDomainName(profile) {
  return 'project_threads_' + createHash('sha256').update(profile).digest('hex').slice(0, 24);
}

export class EnvironmentError extends Error {
  constructor(code, message) { super(message); this.name = 'EnvironmentError'; this.code = code; }
}
export function isWithin(parent, child, allowEqual = false) {
  const delta = relative(parent, child);
  return delta === '' ? allowEqual : delta !== '..' && !delta.startsWith('..' + sep) && !isAbsolute(delta);
}
/** Resolve existing ancestors first, including symlinks; support a new leaf without creating it. */
export async function canonicalPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new EnvironmentError('PATH_REQUIRED', 'An explicit non-empty path is required');
  let cursor = resolve(value); const suffix = [];
  for (;;) {
    try { return resolve(await realpath(cursor), ...suffix.reverse()); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(cursor);
      if (parent === cursor) throw error;
      suffix.push(relative(parent, cursor)); cursor = parent;
    }
  }
}
export async function validateFixtureRoot(candidate, { allowedRoot, sourceRoots = [], dshHome, otherRoots = [], temporaryRoots = [tmpdir(), '/tmp'] }) {
  const [root, allowed, home] = await Promise.all([canonicalPath(candidate), canonicalPath(allowedRoot), canonicalPath(homedir())]);
  if (isWithin(allowed, home, true)) throw new EnvironmentError('BROAD_ROOT', 'The allowed root must not contain the whole OS home');
  if (!isWithin(allowed, root)) throw new EnvironmentError('OUTSIDE_ALLOWED_ROOT', 'Fixture must be a strict descendant of the explicit allowed root');
  const forbidden = [...sourceRoots, ...temporaryRoots, ...(dshHome ? [dshHome] : [])];
  for (const path of forbidden) {
    const normalized = await canonicalPath(path);
    if (isWithin(normalized, root, true) || isWithin(root, normalized, true)) throw new EnvironmentError('FORBIDDEN_FIXTURE_ROOT', 'Fixture intersects a source, temporary or DSH data root');
  }
  const productionHome = join(home, '.dsh'); // Do not read or enumerate the production directory.
  if (isWithin(productionHome, root, true) || isWithin(root, productionHome, true)) throw new EnvironmentError('PRODUCTION_ROOT', 'Production DSH data cannot be a fixture');
  for (const path of otherRoots) {
    const other = await canonicalPath(path);
    if (isWithin(other, root, true) || isWithin(root, other, true)) throw new EnvironmentError('OVERLAPPING_ROOTS', 'Session workspace roots must be disjoint');
  }
  return root;
}
export async function createFixtureRoot(candidate, options) {
  const expected = await validateFixtureRoot(candidate, options);
  await mkdir(expected, { recursive: true });
  const actual = await realpath(candidate);
  if (actual !== expected) throw new EnvironmentError('PATH_CHANGED', 'Fixture canonical path changed during creation');
  await validateFixtureRoot(actual, options);
  return actual;
}
export async function resolveEnvironment(input) {
  const allowedRoot = await canonicalPath(input.allowedRoot);
  const sourceRoots = await Promise.all((input.sourceRoots ?? []).map(canonicalPath));
  const dshHome = await canonicalPath(input.dshHome);
  const fixturesRoot = await validateFixtureRoot(input.fixturesRoot, { allowedRoot, sourceRoots, dshHome });
  const [evidenceRoot, launchCwd] = await Promise.all([canonicalPath(input.evidenceRoot), canonicalPath(input.launchCwd)]);
  const approvedExternalHome=input.approvedExternalDshHome?await canonicalPath(input.approvedExternalDshHome):null;
  for (const [name, path] of Object.entries({ dshHome, evidenceRoot, launchCwd })) {
    if (!isWithin(allowedRoot, path) && !(name==='dshHome' && approvedExternalHome===path)) throw new EnvironmentError('OUTSIDE_ALLOWED_ROOT', name + ' must be inside the explicit isolated root');
    if (sourceRoots.some(source => isWithin(source, path, true))) throw new EnvironmentError('SOURCE_OUTPUT', name + ' must not be inside source');
  }
  if (typeof input.profile !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(input.profile)) throw new EnvironmentError('INVALID_PROFILE', 'A valid explicit profile name is required');
  const dshBin = await canonicalPath(input.dshBin); await access(dshBin, constants.X_OK);
  return { allowedRoot, sourceRoots, dshHome, fixturesRoot, evidenceRoot, launchCwd, profile: input.profile, dshBin };
}
