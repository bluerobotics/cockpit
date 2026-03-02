import { execSync } from 'child_process'

import type { AppVersionInfo } from './cosmos'

/**
 * Derives the GitHub link for a given version string.
 * PR versions (e.g. "0.0.0-1234") link to the pull request page.
 * Tag versions link to the releases page. Commit hashes link to the commit page.
 * @param {string} version - The version string
 * @param {string} repoUrl - The base repository URL
 * @returns {string} The GitHub link for the version
 */
function getVersionLink(version: string, repoUrl: string): string {
  const prMatch = version.match(/^0\.0\.0-(\d+)$/)
  if (prMatch) {
    return `${repoUrl}/pull/${prMatch[1]}`
  }
  return `${repoUrl}/releases/tag/v${version}`
}

/**
 * Returns the version information of the application.
 * If the COCKPIT_VERSION env var is set (e.g. in CI for PR builds), it is used directly.
 * Otherwise, uses git commands to get the version (tag or commit), date, and link to GitHub.
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

  const envVersion = process.env.COCKPIT_VERSION
  if (envVersion) {
    const date = (() => {
      try {
        return execSync('git show -s --format=%ai HEAD', { encoding: 'utf8' }).trim().split(' ')[0]
      } catch {
        return new Date().toISOString().split('T')[0]
      }
    })()
    return {
      version: envVersion,
      date,
      link: getVersionLink(envVersion, repoUrl),
    }
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
