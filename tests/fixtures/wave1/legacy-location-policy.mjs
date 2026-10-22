import { resolve } from 'node:path';
/** The original rejected Mac prefix policy, preserved only as a regression witness. Never shipped. */
export function assertLegacyFixtureLocation(root) {
  if (resolve(root).startsWith('/tmp/') || !resolve(root).startsWith('/root/dsh-project-threads-wave1-')) throw new Error('Invalid isolated fixture location');
}
