/**
 * Convert a Claude project directory name to a readable project name.
 * e.g. "-Users-shay-Documents-Business-clients-ME-Projects-whatsapp" -> "whatsapp"
 */
export function projectDirToName(dirName: string): string {
  // Split by hyphens, take the last meaningful segment
  const parts = dirName.split('-').filter(Boolean)
  if (parts.length === 0) return dirName

  // Return the last part as the project name
  return parts.at(-1) ?? dirName
}

/**
 * Convert a Claude project directory name to a readable path.
 * e.g. "-Users-shay-Documents-Business-clients-ME-Projects-whatsapp" -> "~/Business/clients/ME/Projects/whatsapp"
 */
export function projectDirToPath(dirName: string): string {
  // Replace leading "-Users-{username}-" and convert hyphens to slashes
  const cleaned = dirName
    .replace(/^-Users-[^-]+-/, '~/')
    .replace(/-/g, '/')

  return cleaned
}
