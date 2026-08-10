/**
 * Pure logic behind the data-lake expression input: what its variable dropdown filters by, where an
 * inserted `{{ variable }}` reference starts, and how the keyboard moves through the dropdown.
 */

const trailingTokenRegex = /[\w/.-]*$/

// Start of an unclosed `{{`, meaning the cursor sits inside a reference the user is still typing.
const openReferenceStart = (textUntilCursor: string): number => {
  const lastOpen = textUntilCursor.lastIndexOf('{{')
  if (lastOpen === -1 || textUntilCursor.includes('}}', lastOpen)) return -1
  return lastOpen
}

/**
 * Term the variable dropdown filters by: the partial name inside an open `{{ ... `, or the
 * variable-like token immediately before the cursor.
 * @param {string} textUntilCursor - The line's content from its start up to the cursor
 * @returns {string} The filter term, empty when there is nothing to filter by
 */
export const filterTermAtCursor = (textUntilCursor: string): string => {
  const lastOpen = openReferenceStart(textUntilCursor)
  if (lastOpen !== -1) return textUntilCursor.slice(lastOpen + 2).trim()
  return textUntilCursor.match(trailingTokenRegex)?.[0] ?? ''
}

/**
 * Column an inserted `{{ variable }}` starts at, so picking from the dropdown replaces an open
 * `{{ ...` instead of nesting braces inside it, or otherwise the token being typed.
 * @param {string} textUntilCursor - The line's content from its start up to the cursor
 * @param {number} cursorColumn - Monaco's 1-based cursor column
 * @returns {number} The 1-based column the insertion should start at
 */
export const insertionStartColumn = (textUntilCursor: string, cursorColumn: number): number => {
  const lastOpen = openReferenceStart(textUntilCursor)
  if (lastOpen !== -1) return lastOpen + 1
  return cursorColumn - (textUntilCursor.match(trailingTokenRegex)?.[0].length ?? 0)
}

/**
 * Where the dropdown highlight lands when the user moves through the list, wrapping at both ends.
 * @param {number} current - Currently highlighted option, `-1` while none is active
 * @param {number} lastIndex - Index of the list's last option
 * @param {'down' | 'up'} direction - Direction the user moved in
 * @returns {number} The option to highlight
 */
export const nextHighlightedIndex = (current: number, lastIndex: number, direction: 'down' | 'up'): number => {
  if (direction === 'down') return current >= lastIndex ? 0 : current + 1
  return current <= 0 ? lastIndex : current - 1
}
