#!/usr/bin/env node
// Read-only regression for the production API -> Storage trust boundary.
// No requests or credentials go to any resolved address. Docker DNS is the real resolver.
// Default: validate the candidate Compose destination from the current API network namespace.
// --runtime: additionally require the running API to use that reviewed destination.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const run = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 20_000 });
const config = JSON.parse(run('compose', '--env-file', 'infra/compose/.env.example', '-f', 'infra/compose/docker-compose.yml', '-p', 'hasheemstudio', 'config', '--no-interpolate', '--format', 'json'));
const api = config.services.api.container_name;
const gateway = config.services['api-gw'].container_name;
const host = config.services.api.environment.API_STORAGE_HOST;
assert.equal(api, 'hasheemstudio-api');
assert.equal(gateway, 'hasheemstudio-envoy');
const [liveApi, liveGateway] = JSON.parse(run('inspect', api, gateway));
for (const c of [liveApi, liveGateway]) assert.equal(c.Config.Labels['com.docker.compose.project'], 'hasheemstudio');
const addresses = new Set(Object.values(liveGateway.NetworkSettings.Networks).flatMap(n => [n.IPAddress, n.GlobalIPv6Address]).filter(Boolean));
const results = JSON.parse(run('exec', api, 'node', '-e', `
(async () => {
 const dns = require('node:dns').promises;
 const addresses = new Set();
 for (let i = 0; i < 12; i++) for (const a of await dns.lookup(process.argv[1], {all:true})) addresses.add(a.address);
 console.log(JSON.stringify([...addresses]));
})().catch(() => process.exit(1));`, host));
assert(results.length > 0, 'Storage gateway must resolve');
assert(results.every(a => addresses.has(a)), 'Storage destination resolves outside the dedicated Studio gateway');
if (process.argv.includes('--runtime')) {
 const current = liveApi.Config.Env.find(e => e.startsWith('API_STORAGE_HOST='))?.slice('API_STORAGE_HOST='.length);
 assert.equal(current, host, 'Runtime must use the reviewed storage destination');
}
console.log(JSON.stringify({passed:true,mode:process.argv.includes('--runtime')?'runtime':'candidate',host,uniqueAddresses:results.length,allAddressesBelongToStudio:true,dnsLookups:12}));
