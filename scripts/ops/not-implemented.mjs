#!/usr/bin/env node
// Explicit placeholder: this task interface is specified in docs/IMPLEMENTATION-PLAN.md
// and docs/MIGRATIONS.md but not yet built. It intentionally fails loudly rather than
// pretending to succeed, so no agent or CI step can mistake a stub for a working command.
const task = process.argv[2] ?? "(unknown task)";
console.error(`[hasheemstudio] '${task}' is not implemented yet.`);
console.error("See docs/STATUS.md for current phase and docs/IMPLEMENTATION-PLAN.md for the phase that implements this command.");
process.exit(1);
