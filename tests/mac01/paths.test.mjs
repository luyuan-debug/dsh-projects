import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalPath, createFixtureRoot, isWithin, profileDomainName, validateFixtureRoot } from '../../src/product/host/environment.mjs';
import { assertLegacyFixtureLocation } from '../fixtures/wave1/legacy-location-policy.mjs';
const parent = process.env.MAC01_TEST_ROOT;
if (!parent) throw new Error('Set MAC01_TEST_ROOT outside source and temporary directories');
async function fixture() { const root = join(parent, 'paths-' + randomUUID()); await mkdir(root, { recursive: true }); return { root, options: { allowedRoot: root, sourceRoots: [join(root,'source')], dshHome: join(root,'dsh-home'), temporaryRoots: [join(root,'temporary')] } }; }
test('Mac-style and Linux-style legal roots no longer require a privileged prefix', async () => {
 const { root, options } = await fixture();
 for (const child of ['Users/audit/thread','root/audit/thread']) { const path = join(root, child); assert.throws(()=>assertLegacyFixtureLocation(path),/Invalid isolated fixture location/);assert.equal(await createFixtureRoot(path, options), path); }
});
test('nonexistent nested paths normalize through their nearest existing parent', async () => { const {root,options} = await fixture(); const path=join(root,'new/a/../b'); assert.equal(await canonicalPath(path),join(root,'new/b')); assert.equal(await createFixtureRoot(path,options),join(root,'new/b')); });
test('a same-prefix sibling is outside the directory boundary', async () => { const {root,options}=await fixture(); assert.equal(isWithin(root,root+'-evil'),false); await assert.rejects(validateFixtureRoot(root+'-evil/thread',options),{code:'OUTSIDE_ALLOWED_ROOT'}); });
test('source, DSH data and temporary roots remain rejected', async () => { const {root,options}=await fixture(); for(const leaf of ['source/thread','dsh-home/thread','temporary/thread']) await assert.rejects(validateFixtureRoot(join(root,leaf),options),{code:'FORBIDDEN_FIXTURE_ROOT'}); });
test('a symlink escape cannot create a workspace outside the allowed boundary', async () => { const {root,options}=await fixture(); const outside=join(parent,'outside-'+randomUUID());await mkdir(outside);await symlink(outside,join(root,'escape'));await assert.rejects(createFixtureRoot(join(root,'escape/thread'),options),{code:'OUTSIDE_ALLOWED_ROOT'}); });
test('a legal internal symlink is canonicalized and revalidated after creation', async () => { const {root,options}=await fixture();await mkdir(join(root,'real'));await symlink(join(root,'real'),join(root,'alias'));assert.equal(await createFixtureRoot(join(root,'alias/thread'),options),join(root,'real/thread')); });
test('nested or equal Session roots fail; disjoint sibling roots pass', async () => { const {root,options}=await fixture(); const existing=join(root,'thread-a');await mkdir(existing);for(const candidate of [existing,join(existing,'nested')]) await assert.rejects(validateFixtureRoot(candidate,{...options,otherRoots:[existing]}),{code:'OVERLAPPING_ROOTS'});assert.equal(await createFixtureRoot(join(root,'thread-b'),{...options,otherRoots:[existing]}),join(root,'thread-b')); });
test('profile namespaces satisfy the real DSH domain grammar without punctuation collisions',()=>{for(const name of ['mac01-dev','mac01.dev','MAC01_dev'])assert.match(profileDomainName(name),/^[a-z][a-z0-9_]*$/);assert.notEqual(profileDomainName('mac01-dev'),profileDomainName('mac01.dev'));});

test('external data home is rejected by default and allowed only by exact explicit approval', async()=>{
 const {root}=await fixture();const allowed=join(root,'allowed'),external=join(root,'data-home');await mkdir(allowed);await mkdir(external);
 const input={allowedRoot:allowed,fixturesRoot:join(allowed,'fixtures'),sourceRoots:[join(allowed,'source')],dshHome:external,evidenceRoot:join(allowed,'evidence'),launchCwd:join(allowed,'launch'),dshBin:process.execPath,profile:'mac02-real-test'};
 const {resolveEnvironment}=await import('../../src/product/host/environment.mjs');
 await assert.rejects(resolveEnvironment(input),{code:'OUTSIDE_ALLOWED_ROOT'});
 await assert.rejects(resolveEnvironment({...input,approvedExternalDshHome:join(root,'other-home')}),{code:'OUTSIDE_ALLOWED_ROOT'});
 const resolved=await resolveEnvironment({...input,approvedExternalDshHome:external});assert.equal(resolved.dshHome,external);assert.equal(resolved.allowedRoot,allowed);
});

test('external data-home approval never widens the fixture boundary',async()=>{
 const {root}=await fixture();const allowed=join(root,'allowed'),external=join(root,'data-home');await mkdir(allowed);await mkdir(external);
 const {resolveEnvironment}=await import('../../src/product/host/environment.mjs');
 await assert.rejects(resolveEnvironment({allowedRoot:allowed,fixturesRoot:join(external,'thread'),sourceRoots:[],dshHome:external,approvedExternalDshHome:external,evidenceRoot:join(allowed,'evidence'),launchCwd:join(allowed,'launch'),dshBin:process.execPath,profile:'mac02-real-test'}),{code:'OUTSIDE_ALLOWED_ROOT'});
});
