function validateEnvs(): void {
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY) {
    if (!process.env.GH_TOKEN) {
      console.error(
        "❌ GH_TOKEN environment variable is required for releasing",
      );
    }

    if (!process.env.GITHUB_REPOSITORY) {
      console.error(
        "❌ GITHUB_REPOSITORY environment variable is required for releasing",
      );
    }

    process.exit(1);
  }
}

export { validateEnvs };
