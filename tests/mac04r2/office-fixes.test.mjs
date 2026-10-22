import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {fileURLToPath}from'node:url';
const script=fileURLToPath(new URL('../../tools/mac04r2/office-fixes.py',import.meta.url));
test('DOCX wrappers ordering nested tables separators and encoding-independent XML admission',()=>{const result=JSON.parse(execFileSync('/usr/bin/python3',['-I',script],{encoding:'utf8'}));assert(result.results.length>=16);assert(result.results.every(r=>r.pass));});
