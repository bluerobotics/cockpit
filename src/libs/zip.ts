import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'

/**
 * A named file to include in a ZIP archive
 */
export interface ZipFileEntry {
  /**
   * Name the file will have inside the archive
   */
  name: string
  /**
   * File contents
   */
  blob: Blob
}

/**
 * Build a ZIP archive from named files, suffixing colliding names with a numeric index so each entry stays unique.
 * @param {ZipFileEntry[]} entries - Files to include in the archive
 * @returns {Promise<Blob>} The generated ZIP archive
 */
export const createZipBlob = async (entries: ZipFileEntry[]): Promise<Blob> => {
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'), { level: 0 })
  const usedNames = new Set<string>()

  for (const { name, blob } of entries) {
    const dotIndex = name.lastIndexOf('.')
    const base = dotIndex === -1 ? name : name.slice(0, dotIndex)
    const extension = dotIndex === -1 ? '' : name.slice(dotIndex)

    let fileName = name
    for (let dedupeIndex = 1; usedNames.has(fileName); dedupeIndex++) {
      fileName = `${base}_${dedupeIndex}${extension}`
    }
    usedNames.add(fileName)

    await zipWriter.add(fileName, new BlobReader(blob))
  }

  return zipWriter.close()
}
