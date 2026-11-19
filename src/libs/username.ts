import { t } from 'ttag'

/**
 * Checks a username against the rules every Cockpit user must follow
 * @param {string} username - The username to validate
 * @returns {true | string} True when valid, otherwise the reason it is not
 */
export const validateUsername = (username: string): true | string => {
  if (username.includes(' ')) {
    return t`Username cannot contain spaces.`
  } else if (username.toLowerCase().includes('cockpit')) {
    return t`Username cannot contain "cockpit" as it is reserved for internal use.`
  } else if (username.toLowerCase().includes('fallback')) {
    return t`Username cannot contain "fallback" as it is reserved for internal use.`
  } else if (username.length < 3) {
    return t`Username must be at least 3 characters long.`
  } else if (username.length > 16) {
    return t`Username must be at most 16 characters long.`
  } else if (!username.match(/^[a-zA-Z0-9_.-]+$/)) {
    return t`Username can only contain letters, numbers, and the following characters: _ - .`
  } else if (username.toLowerCase() !== username) {
    return t`Username must be lowercase.`
  }
  return true
}
