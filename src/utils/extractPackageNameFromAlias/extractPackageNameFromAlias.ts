function extractPackageNameFromAlias(dependency: string): string | null {
  const m = dependency.match(/^npm:(@?[^@]+)(?:@.*)?$/);
  return m ? m[1] : null;
}

export { extractPackageNameFromAlias };
