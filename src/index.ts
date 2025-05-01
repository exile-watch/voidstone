#!/usr/bin/env node

import { main } from "./main/main.js";
/**
 * Main release flow
 */
main().catch((err) => {
  console.error("Release failed with error:");
  if (err instanceof Error) {
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    const execError = err as { stdout?: Buffer; stderr?: Buffer };
    if (execError.stdout) console.error("stdout:", execError.stdout.toString());
    if (execError.stderr) console.error("stderr:", execError.stderr.toString());
  } else {
    console.error(err);
  }
  process.exit(1);
});
