import { execSync } from 'child_process'

import type { AppVersionInfo } from './cosmos'

/**
 * Returns the version information of the application.
 * Uses git commands to get the version (tag or commit), date, and link to GitHub.
 * Returns fallback values if git commands fail.
 * @returns {AppVersionInfo}
 */
export function getVersion(): AppVersionInfo {
  const repoUrl = 'https://github.com/bluerobotics/cockpit'
  const fallback: AppVersionInfo = {
    version: 'unknown',
    date: 'unknown',
    link: repoUrl,
  }

  try {
    // Try to get the latest tag
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
    if (tag) {
      // Get the tag date
      const date = execSync(`git log -1 --format=%ai ${tag}`, { encoding: 'utf8' }).trim()
      return {
        version: tag.startsWith('v') ? tag.substring(1) : tag,
        date: date.split(' ')[0], // Get just the date part
        link: `${repoUrl}/releases/tag/${tag}`,
      }
    }
  } catch {
    try {
      // If no tags exist, get the commit hash
      const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
      const date = execSync('git show -s --format=%ai HEAD', { encoding: 'utf8' }).trim()
      return {
        version: commitHash.substring(0, 8),
        date: date.split(' ')[0], // Get just the date part
        link: `${repoUrl}/commit/${commitHash}`,
      }
    } catch {
      // If git commands fail, return fallback values
      return fallback
    }
  }
  return fallback
}
