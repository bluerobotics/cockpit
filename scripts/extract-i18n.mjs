/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parse } from '@vue/compiler-sfc'
import gettextParser from 'gettext-parser'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, sep } from 'node:path'
import { execPath } from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcRoot = join(root, 'src')
const i18nDir = join(srcRoot, 'i18n')
const locales = ['pt_BR']
const ttagEntry = join(root, 'node_modules', 'ttag-cli', 'bin', 'ttag')
const ttagTags = ['t', 'gettext', 'ngettext', 'jt']
const ignoredDirectories = new Set(['node_modules', 'electron', 'm2r', 'mavlink-json', 'ParameterRepository'])

// Vue template AST node types: element, interpolation and directive
const ELEMENT = 1
const INTERPOLATION = 5
const DIRECTIVE = 7

const walkFiles = (directory) => {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (!entry.isDirectory()) {
      files.push(path)
    } else if (!ignoredDirectories.has(entry.name)) {
      files.push(...walkFiles(path))
    }
  }
  return files.sort()
}

const collectTemplateExpressions = (node, expressions) => {
  if (node.type === INTERPOLATION) expressions.push(node.content.content)
  if (node.type === ELEMENT) {
    node.props
      .filter((prop) => prop.type === DIRECTIVE && prop.exp)
      .forEach((prop) => expressions.push(prop.exp.content))
  }
  node.children?.forEach((child) => collectTemplateExpressions(child, expressions))
}

const containsTtag = (expression) => {
  const source = ts.createSourceFile('expression.ts', `(${expression})`, ts.ScriptTarget.Latest, true)
  const isTag = (node) => ts.isIdentifier(node) && ttagTags.includes(node.text)
  const visit = (node) => {
    if (ts.isTaggedTemplateExpression(node) && isTag(node.tag)) return true
    if (ts.isCallExpression(node) && isTag(node.expression)) return true
    return ts.forEachChild(node, visit) ?? false
  }
  return visit(source)
}

const transpile = (source, fileName) => {
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  return ts.transpileModule(source, { compilerOptions, fileName }).outputText
}

// ttag-cli only reads JavaScript, so a component becomes its template's translated expressions plus its scripts
const javascriptFromVue = (source, fileName) => {
  const { descriptor, errors } = parse(source, { filename: fileName })
  if (errors.length > 0) throw new Error(`Failed to parse ${fileName}: ${errors.join('\n')}`)
  const parts = []
  if (descriptor.template?.ast) {
    const expressions = []
    collectTemplateExpressions(descriptor.template.ast, expressions)
    parts.push(...expressions.filter(containsTtag).map((expression) => `void (${expression})`))
  }
  for (const script of [descriptor.script, descriptor.scriptSetup]) {
    if (script?.content) parts.push(script.lang === 'ts' ? transpile(script.content, fileName) : script.content)
  }
  return parts.join('\n')
}

const javascriptFromFile = (path) => {
  const source = readFileSync(path, 'utf8')
  return extname(path) === '.vue' ? javascriptFromVue(source, path) : transpile(source, path)
}

const shouldExtract = (path) => {
  if (path.endsWith('.d.ts') || path.startsWith(i18nDir)) return false
  return ['.vue', '.ts'].includes(extname(path))
}

const runTtag = (args) => {
  // Running the entry with node directly needs no shell, so paths with spaces work on Windows too
  const result = spawnSync(execPath, [ttagEntry, ...args], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`ttag ${args.join(' ')} failed: ${result.error?.message ?? result.status}`)
}

// Fixed dates keep the catalogs from changing on every run when no string did
const stabilizeCatalog = (content) => {
  return content
    .replace(/POT-Creation-Date: .*\\n/g, 'POT-Creation-Date: YEAR-MO-DA HO:MI+ZONE\\n')
    .replace(/PO-Revision-Date: .*\\n/g, 'PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n')
}

const englishCatalogFromTtag = (ttagOutputPath, stagingRoot) => {
  return readFileSync(ttagOutputPath, 'utf8')
    .replace(/^#: .*$/gm, (references) => references.replaceAll('\\', '/'))
    .replaceAll(`${stagingRoot.replaceAll(sep, '/')}/`, '')
    .replaceAll('.vue.js', '.vue')
    .replaceAll('.ts.js', '.ts')
}

const isTranslated = (message) => message?.msgstr?.some((text) => text !== '')

// Flattens gettext's context -> msgid -> message map into a list
const entriesOf = (section = {}) =>
  Object.entries(section).flatMap(([context, messages]) =>
    Object.entries(messages).map(([msgid, message]) => ({ context, msgid, message }))
  )

// Keeps every English string in the locale catalog, carrying over existing translations and leaving new ones empty.
// Translations whose English string is gone stay as obsolete (#~) entries, and come back if the string does.
const mergeLocaleCatalog = (language, english, locale) => {
  const headers = {
    ...locale.headers,
    ...english.headers,
    'Language': language,
    'Content-Type': 'text/plain; charset=utf-8',
    'Plural-Forms': locale.headers['Plural-Forms'] || 'nplurals=2; plural=(n != 1);',
  }

  const known = {}
  for (const { context, msgid, message } of [...entriesOf(locale.obsolete), ...entriesOf(locale.translations)]) {
    if (msgid !== '' && isTranslated(message)) known[context] = { ...known[context], [msgid]: message }
  }

  const translations = {}
  for (const { context, msgid, message } of entriesOf(english.translations)) {
    const msgstr = known[context]?.[msgid]?.msgstr ?? ['']
    translations[context] = { ...translations[context], [msgid]: msgid === '' ? message : { ...message, msgstr } }
  }

  const obsolete = {}
  for (const { context, msgid, message } of entriesOf(known)) {
    if (translations[context]?.[msgid]) continue
    obsolete[context] = { ...obsolete[context], [msgid]: { ...message, comments: undefined } }
  }

  const compiled = gettextParser.po.compile({ charset: 'utf-8', headers, translations, obsolete }).toString()
  return stabilizeCatalog(compiled.endsWith('\n') ? compiled : `${compiled}\n`)
}

const stagingRoot = mkdtempSync(join(tmpdir(), 'cockpit-i18n-'))
try {
  let stagedFiles = 0
  for (const path of walkFiles(srcRoot).filter(shouldExtract)) {
    const javascript = javascriptFromFile(path)
    if (!javascript.trim()) continue
    const stagedPath = join(stagingRoot, `${relative(root, path)}.js`)
    mkdirSync(dirname(stagedPath), { recursive: true })
    writeFileSync(stagedPath, javascript)
    stagedFiles++
  }
  if (stagedFiles === 0) throw new Error('No source files found for extraction')

  const discoverArgs = ttagTags.flatMap((tag) => ['--discover', tag])
  const extractArgs = ['--numberedExpressions', '--sortByMsgid', '--extractLocation', 'file', ...discoverArgs]
  const ttagOutputPath = join(stagingRoot, 'en.po')
  runTtag(['extract', ...extractArgs, '-o', ttagOutputPath, join(stagingRoot, 'src')])

  // Every catalog is built before any is written, so a failed run leaves the committed ones untouched
  const englishCatalog = englishCatalogFromTtag(ttagOutputPath, stagingRoot)
  const english = gettextParser.po.parse(englishCatalog)
  const catalogs = []
  for (const language of locales) {
    const path = join(i18nDir, `${language}.po`)
    const locale = existsSync(path) ? gettextParser.po.parse(readFileSync(path)) : { headers: {}, translations: {} }
    catalogs.push([path, mergeLocaleCatalog(language, english, locale)])
  }
  mkdirSync(i18nDir, { recursive: true })
  catalogs.forEach(([path, content]) => writeFileSync(path, content))
  const written = catalogs.map(([path]) => relative(root, path)).join(', ')
  console.log(`Extracted translations from ${stagedFiles} files into ${written}`)
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}
