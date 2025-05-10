import { type ExecSyncOptions, execSync } from "node:child_process";

function execWithLog(command: string, options: ExecSyncOptions = {}): string {
  const workingDir = options.cwd ? ` (in ${options.cwd})` : "";
  console.log(`ℹ️ Executing: ${command}${workingDir}`);
  try {
    const output = execSync(command, {
      ...options,
      encoding: "utf8",
      stdio: options.stdio || "pipe",
    });
    if (output && output.length > 0) {
      console.log(`✅ Output:\n${output.trim()}`);
    }
    console.log(`✅ Executed: ${command}${workingDir}`);
    return output;
  } catch (error) {
    console.error(`❌ Failed: ${command}${workingDir}`);
    throw error;
  }
}

export { execWithLog };
