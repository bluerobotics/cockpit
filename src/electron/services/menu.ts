import { app, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'

import { ROOT_PATH } from '../main'

interface Translations {
  [key: string]: {
    menu: {
      file: string
      edit: string
      view: string
      window: string
      help: string
      reload: string
      forceReload: string
      toggleDevTools: string
      actualSize: string
      zoomIn: string
      zoomOut: string
      toggleFullScreen: string
      undo: string
      redo: string
      cut: string
      copy: string
      paste: string
      selectAll: string
      minimize: string
      close: string
      quit: string
      learnMore: string
    }
  }
}

let translations: Translations = {
  en: {
    menu: {
      file: 'File',
      edit: 'Edit',
      view: 'View',
      window: 'Window',
      help: 'Help',
      reload: 'Reload',
      forceReload: 'Force Reload',
      toggleDevTools: 'Toggle Developer Tools',
      actualSize: 'Actual Size',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      toggleFullScreen: 'Toggle Full Screen',
      undo: 'Undo',
      redo: 'Redo',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      selectAll: 'Select All',
      minimize: 'Minimize',
      close: 'Close',
      quit: 'Quit',
      learnMore: 'Learn More',
    },
  },
  zh: {
    menu: {
      file: '文件',
      edit: '编辑',
      view: '视图',
      window: '窗口',
      help: '帮助',
      reload: '重新加载',
      forceReload: '强制重新加载',
      toggleDevTools: '切换开发者工具',
      actualSize: '实际大小',
      zoomIn: '放大',
      zoomOut: '缩小',
      toggleFullScreen: '切换全屏',
      undo: '撤销',
      redo: '重做',
      cut: '剪切',
      copy: '复制',
      paste: '粘贴',
      selectAll: '全选',
      minimize: '最小化',
      close: '关闭',
      quit: '退出',
      learnMore: '了解更多',
    },
  },
}

/**
 * Load translations from locale files
 */
function loadTranslations(): void {
  try {
    const localesPath = join(ROOT_PATH.dist, 'locales')
    const enPath = join(localesPath, 'en.json')
    const zhPath = join(localesPath, 'zh.json')

    const enData = JSON.parse(readFileSync(enPath, 'utf-8'))
    const zhData = JSON.parse(readFileSync(zhPath, 'utf-8'))

    // Merge with existing translations
    if (enData.menu) {
      translations.en.menu = { ...translations.en.menu, ...enData.menu }
    }
    if (zhData.menu) {
      translations.zh.menu = { ...translations.zh.menu, ...zhData.menu }
    }
  } catch (error) {
    console.warn('Could not load locale files, using default translations:', error)
  }
}

/**
 * Get current language from localStorage or system
 */
function getCurrentLanguage(): string {
  try {
    // Try to read from config store if available
    const savedLocale = app.getLocale()
    const locale = savedLocale.split('-')[0]
    return locale === 'zh' ? 'zh' : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Create application menu with translations
 */
function createMenu(locale: string = 'en'): Menu {
  const t = translations[locale]?.menu || translations.en.menu

  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { label: t.quit, role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: t.file,
      submenu: [isMac ? { label: t.close, role: 'close' as const } : { label: t.quit, role: 'quit' as const }],
    },
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: 'undo' as const },
        { label: t.redo, role: 'redo' as const },
        { type: 'separator' as const },
        { label: t.cut, role: 'cut' as const },
        { label: t.copy, role: 'copy' as const },
        { label: t.paste, role: 'paste' as const },
        { label: t.selectAll, role: 'selectAll' as const },
      ],
    },
    {
      label: t.view,
      submenu: [
        { label: t.reload, role: 'reload' as const },
        { label: t.forceReload, role: 'forceReload' as const },
        { label: t.toggleDevTools, role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { label: t.actualSize, role: 'resetZoom' as const },
        { label: t.zoomIn, role: 'zoomIn' as const },
        { label: t.zoomOut, role: 'zoomOut' as const },
        { type: 'separator' as const },
        { label: t.toggleFullScreen, role: 'togglefullscreen' as const },
      ],
    },
    {
      label: t.window,
      submenu: [
        { label: t.minimize, role: 'minimize' as const },
        { label: t.close, role: 'close' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : []),
      ],
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.learnMore,
          click: async () => {
            const { shell } = await import('electron')
            await shell.openExternal('https://docs.bluerobotics.com/ardusub-zola/software/onboard/cockpit/')
          },
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

/**
 * Setup and initialize menu service
 */
export function setupMenuService(): void {
  loadTranslations()
  
  // Default to Chinese as per user requirements
  const locale = 'zh'
  const menu = createMenu(locale)
  Menu.setApplicationMenu(menu)

  // Setup IPC handler for menu language updates
  ipcMain.handle('update-menu-language', (_event, newLocale: string) => {
    updateMenuLanguage(newLocale)
  })

  console.log(`Menu initialized with locale: ${locale}`)
}

/**
 * Update menu language
 */
export function updateMenuLanguage(locale: string): void {
  const menu = createMenu(locale)
  Menu.setApplicationMenu(menu)
  console.log(`Menu language updated to: ${locale}`)
}
