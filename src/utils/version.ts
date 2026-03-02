import { execSync } from 'child_process'

/**
 * Returns the version of the application.
 * If the COCKPIT_VERSION env var is set (e.g. in CI for PR builds), it is used directly.
 * Otherwise, uses the git describe command to get the latest tag, or the commit hash if no tags exist.
 * Returns a fallback version 'unknown' if git commands fail.
 * @returns {string}
 */
export function getVersion(): string {
  const envVersion = process.env.COCKPIT_VERSION
  if (envVersion) {
    return envVersion
  }

  try {
    // Try to get the latest tag
    const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
    return latestTag
  } catch {
    try {
      // If no tags exist, get the commit hash
      const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
      return commitHash.substring(0, 8)
    } catch {
      // If git commands fail, return a fallback version
      return 'unknown'
    }
  }
}
