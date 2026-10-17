import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('the executable runs through the symlink used by an installed npm bin', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'feed-memory-bin-'));
  try {
    const binary = join(directory, 'feed-research-memory');
    await symlink(fileURLToPath(new URL('../src/cli.mjs', import.meta.url)), binary);
    const { stdout } = await promisify(execFile)(process.execPath, [binary, '--help']);
    const output = JSON.parse(stdout);
    assert.match(output.help, /recall --graph/);
    assert.match(output.help, /import <feed.xml>/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
