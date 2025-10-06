/**
 * File statistics information
 */
export interface FileStats {
  /**
   * The existence of the file
   */
  exists: boolean
  /**
   * The size of the file
   */
  size?: number
  /**
   * The last modified time of the file
   */
  mtime?: Date
  /**
   * If the file is a directory or not
   */
  isDirectory?: boolean
  /**
   * If the file is a file or not
   */
  isFile?: boolean
}

/**
 * File dialog filter configuration
 */
export interface FileDialogFilter {
  /**
   * The name of the filter
   */
  name: string
  /**
   * The extensions of the filter
   */
  extensions: string[]
}

/**
 * File dialog options configuration
 */
export interface FileDialogOptions {
  /**
   * The title of the dialog
   */
  title?: string
  /**
   * The filters of the dialog
   */
  filters?: FileDialogFilter[]
  /**
   * The default path of the dialog
   */
  defaultPath?: string
}
