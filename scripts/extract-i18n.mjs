/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parse } from '@vue/compiler-sfc'
import gettextParser from 'gettext-parser'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcRoot = join(root, 'src')
const i18nDir = join(srcRoot, 'i18n')
const englishPoPath = join(i18nDir, 'en.po')
const locales = ['pt_BR']
const ttagBin = join(root, 'node_modules', '.bin', 'ttag')
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
  const result = spawnSync(ttagBin, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`ttag ${args.join(' ')} failed`)
}

// Fixed dates keep the catalogs from changing on every run when no string did
const stabilizeCatalog = (content) => {
  return content
    .replace(/POT-Creation-Date: .*\\n/g, 'POT-Creation-Date: YEAR-MO-DA HO:MI+ZONE\\n')
    .replace(/PO-Revision-Date: .*\\n/g, 'PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n')
}

const writeEnglishCatalog = (stagingRoot) => {
  const content = readFileSync(englishPoPath, 'utf8')
    .replaceAll(`${stagingRoot}/`, '')
    .replaceAll('.vue.js', '.vue')
    .replaceAll('.ts.js', '.ts')
  const withLanguage = content.includes('Language: en')
    ? content
    : content.replace(
        '"Content-Type: text/plain; charset=utf-8\\n"\n',
        '"Content-Type: text/plain; charset=utf-8\\n"\n"Language: en\\n"\n'
      )
  writeFileSync(englishPoPath, stabilizeCatalog(withLanguage))
}

// Keeps every English string in the locale catalog, carrying over existing translations and leaving new ones empty
const syncLocaleFromEnglish = (language) => {
  const localePoPath = join(i18nDir, `${language}.po`)
  const english = gettextParser.po.parse(readFileSync(englishPoPath))
  const locale = existsSync(localePoPath)
    ? gettextParser.po.parse(readFileSync(localePoPath))
    : { headers: {}, translations: { '': {} } }

  const headers = {
    ...english.headers,
    ...locale.headers,
    'Language': language,
    'Content-Type': 'text/plain; charset=utf-8',
    'Plural-Forms': locale.headers['Plural-Forms'] || 'nplurals=2; plural=(n != 1);',
  }
  const translations = {}
  for (const [context, messages] of Object.entries(english.translations)) {
    const localeMessages = locale.translations[context] ?? {}
    translations[context] = {}
    for (const [msgid, message] of Object.entries(messages)) {
      const msgstr = localeMessages[msgid]?.msgstr?.length ? localeMessages[msgid].msgstr : ['']
      translations[context][msgid] = msgid === '' ? message : { ...message, msgstr }
    }
  }

  const compiled = gettextParser.po.compile({ charset: 'utf-8', headers, translations }).toString()
  writeFileSync(localePoPath, stabilizeCatalog(compiled.endsWith('\n') ? compiled : `${compiled}\n`))
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

  mkdirSync(i18nDir, { recursive: true })
  const discoverArgs = ttagTags.flatMap((tag) => ['--discover', tag])
  const extractArgs = ['--numberedExpressions', '--sortByMsgid', '--extractLocation', 'file', ...discoverArgs]
  runTtag(['extract', ...extractArgs, '-o', englishPoPath, stagingRoot])
  writeEnglishCatalog(stagingRoot)
  locales.forEach(syncLocaleFromEnglish)
  console.log(`Extracted translations from ${stagedFiles} files into ${relative(root, englishPoPath)}`)
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}
