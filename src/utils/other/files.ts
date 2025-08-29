// Small file helpers used across handlers

export function extFrom(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function safeName(name: string): string {
  // strip any path parts and sanitize to a safe basename
  const base = name.replace(/^.*[\\/]/, "");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}
