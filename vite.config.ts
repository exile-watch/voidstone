import { builtinModules } from "node:module";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node16",
    lib: {
      entry: "src/index.ts",
      name: "voidstone",
      formats: ["es"],
      fileName: (format) => `voidstone.${format}.js`,
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        /^node:.*/,
        "unicorn-magic",
        "fast-glob",
        "semver",
        "conventional-recommended-bump",
        "conventional-changelog",
        "get-stream",
        "@octokit/rest",
      ],
    },
  },
});
