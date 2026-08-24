/**
 * How much of a recording's head the main process needs before it can read the codec out of the Matroska
 * header, and how many chunks it may join to get there. MediaRecorder normally writes that header within the
 * first couple of hundred bytes, but it can emit a first chunk of a single byte, splitting even the EBML magic.
 */
export const minimumRecordingHeadBytes = 16 * 1024
export const maxRecordingHeadChunks = 5

/**
 * A recording's head, and how many of its chunks were joined to make it
 */
export interface RecordingHead {
  /**
   * The joined leading chunks
   */
  head: Blob
  /**
   * How many chunks went into it, and thus how many the caller must not send again
   */
  consumed: number
}

/**
 * Joins a recording's leading chunks until they carry enough of its header to read the codec from.
 * @param {(index: number) => Promise<Blob | undefined>} readChunk - Reads the chunk at an index, in order
 * @returns {Promise<RecordingHead>} The joined head and how many chunks went into it
 */
export const joinRecordingHead = async (
  readChunk: (index: number) => Promise<Blob | undefined>
): Promise<RecordingHead> => {
  const parts: Blob[] = []
  let size = 0
  while (size < minimumRecordingHeadBytes && parts.length < maxRecordingHeadChunks) {
    const chunk = await readChunk(parts.length)
    if (!chunk) break
    parts.push(chunk)
    size += chunk.size
  }
  return { head: new Blob(parts), consumed: parts.length }
}
