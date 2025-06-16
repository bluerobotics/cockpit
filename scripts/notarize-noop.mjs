/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-env node */

/**
 * No-op notarization for PR builds
 * @param {import('@electron/notarize').NotarizeContext} context
 * @returns {Promise<void>}
 */
export default async function notarizingNoop(context) {
  const { electronPlatformName } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  console.log('Skipping notarization for PR build.')
  return Promise.resolve()
}
