// Bulk-replace native <select> with our <Select> component across page files.
// Conservative: only transforms simple, well-formed select blocks. Skips complex
// ones (e.g. with conditional children, refs, custom event handlers).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (p.endsWith('.tsx')) acc.push(p)
  }
  return acc
}
const files = walk('app').filter(f => readFileSync(f, 'utf8').includes('<select'))

console.log(`Found ${files.length} files with <select>`)

let totalConverted = 0
let totalSkipped = 0
const failures = []

for (const filePath of files) {
  let src = readFileSync(filePath, 'utf8')
  const original = src
  let converted = 0
  let skipped = 0

  // Skip if it already imports Select
  const hasImport = /import Select from ['"]@\/components\/ui\/Select['"]/.test(src)

  // Find <select ... > ... </select> blocks via brace-aware scanning
  // (regex breaks because `e =>` contains `>` inside the opening tag)
  function findSelects(text) {
    const results = []
    let i = 0
    while (i < text.length) {
      const startIdx = text.indexOf('<select', i)
      if (startIdx === -1) break
      // Walk forward to find the closing `>` of the opening tag, respecting `{}` depth
      let depth = 0
      let tagEnd = -1
      for (let j = startIdx + 7; j < text.length; j++) {
        const ch = text[j]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0) { tagEnd = j; break }
      }
      if (tagEnd === -1) { i = startIdx + 1; continue }
      // Now find </select>
      const closeIdx = text.indexOf('</select>', tagEnd)
      if (closeIdx === -1) { i = tagEnd + 1; continue }
      const attrsRaw = text.slice(startIdx + 7, tagEnd)
      const childrenRaw = text.slice(tagEnd + 1, closeIdx)
      const full = text.slice(startIdx, closeIdx + 9)
      results.push({ start: startIdx, end: closeIdx + 9, full, attrsRaw, childrenRaw })
      i = closeIdx + 9
    }
    return results
  }

  const blocks = findSelects(src).reverse() // process from end to keep offsets valid
  for (const { start, end, full, attrsRaw, childrenRaw } of blocks) {
    const replaced = (function transform() {
    // Extract value={...}
    const valueMatch = attrsRaw.match(/value=\{([^}]+?)\}/)
    if (!valueMatch) { skipped++; if (process.env.DEBUG) console.log('  no value:', full.slice(0, 80)); return full }

    // Extract onChange={e => ...} — handle simple expressions
    const onChangeMatch = attrsRaw.match(/onChange=\{e\s*=>\s*([^{}]+(?:\{[^}]*\}[^{}]*)?)\}/)
    if (!onChangeMatch) { skipped++; if (process.env.DEBUG) console.log('  no onChange:', full.slice(0, 200)); return full }

    const valueExpr = valueMatch[1].trim()
    const onChangeExpr = onChangeMatch[1].trim()

    // Build onValueChange: substitute e.target.value with v
    const onValueChange = onChangeExpr.replace(/e\.target\.value/g, 'v')

    // Extract optional className and disabled
    const disabledMatch = attrsRaw.match(/(\bdisabled(?:=\{[^}]+\})?)/)

    // Parse children: identify literal <option> elements and a single .map() expression
    const trimmedChildren = childrenRaw.trim()

    // Detect: empty placeholder <option value="">label</option>
    const placeholderRe = /<option\s+value=""\s*>([^<]*)<\/option>/
    const placeholderMatch = trimmedChildren.match(placeholderRe)
    const placeholder = placeholderMatch ? placeholderMatch[1].trim() : null
    let rest = placeholderMatch ? trimmedChildren.replace(placeholderMatch[0], '').trim() : trimmedChildren

    // Convert a JSX label expression to a JS expression (for use as `label`).
    function jsxLabelToExpr(labelInner) {
      const t = labelInner.trim()
      // Pure single expression: {expr}
      if (/^\{[^{}]+\}$/.test(t)) return t.slice(1, -1).trim()
      // No expressions: plain text -> string literal
      if (!t.includes('{')) return JSON.stringify(t)
      // Mixed: text + {expr} + ... -> template literal
      // Replace {expr} → ${expr}, escape backticks in literals
      const tpl = t.replace(/`/g, '\\`').replace(/\{([^{}]+)\}/g, '${$1}')
      return '`' + tpl + '`'
    }

    // Match `.map(varName => <option ... >LABEL</option>)`. Tolerant of optional className/parens.
    function matchMapPattern(text) {
      const m = text.match(/^\{(\s*[^{}]+?)\.map\(\s*([\w$]+)\s*=>\s*\(?\s*<option\s+([^>]*?)>([\s\S]*?)<\/option>\s*\)?\s*\)\s*\}$/)
      if (!m) return null
      const [, arrExpr, varName, optAttrs, labelInner] = m
      const valueMatch = optAttrs.match(/value=\{([^}]+)\}/) || optAttrs.match(/value="([^"]*)"/)
      if (!valueMatch) return null
      const valueExpr = optAttrs.includes('value="') ? `'${valueMatch[1]}'` : valueMatch[1]
      return { arrExpr, varName, valueExpr, labelExpr: jsxLabelToExpr(labelInner) }
    }

    let optionsExpr = null
    const mp = matchMapPattern(rest)
    if (mp) {
      optionsExpr = `${mp.arrExpr}.map(${mp.varName} => ({ value: ${mp.valueExpr}, label: ${mp.labelExpr} }))`
    } else {
      // Multiple literal <option> elements
      const optMatches = [...rest.matchAll(/<option\s+value=(?:"([^"]*)"|\{([^}]+)\})\s*>([\s\S]*?)<\/option>/g)]
      if (!optMatches.length) { skipped++; return full }
      const arr = optMatches.map(om => {
        const v = om[1] !== undefined ? `'${om[1]}'` : om[2]
        const label = om[3].trim()
        let labelExpr
        if (/^\{[^}]+\}$/.test(label)) labelExpr = label.slice(1, -1)
        else labelExpr = JSON.stringify(label)
        return `{ value: ${v}, label: ${labelExpr} }`
      })
      optionsExpr = `[${arr.join(', ')}]`
    }

    converted++
    const placeholderProp = placeholder ? ` placeholder="${placeholder.replace(/"/g, '&quot;')}"` : ''
    const clearProp = placeholder ? ` allowClear clearLabel="${placeholder.replace(/"/g, '&quot;')}"` : ''
    const disabledProp = disabledMatch ? ` ${disabledMatch[0]}` : ''
    return `<Select value={${valueExpr}} onValueChange={v => ${onValueChange}}${placeholderProp}${clearProp}${disabledProp}\n              options={${optionsExpr}} />`
    })()
    if (replaced !== full) {
      src = src.slice(0, start) + replaced + src.slice(end)
    }
  }

  // Add import if any conversion happened and not already present
  if (converted > 0 && !hasImport) {
    // Insert after the last import statement
    const importRe = /^(import [\s\S]+?from ['"][^'"]+['"]\s*\n)+/m
    const m = src.match(importRe)
    if (m) {
      src = src.replace(importRe, m[0] + "import Select from '@/components/ui/Select'\n")
    }
  }

  if (src !== original) {
    writeFileSync(filePath, src)
    console.log(`  ${filePath.replace(/.*icrm-app[\\/]/, '')} → ${converted} converted, ${skipped} skipped`)
    totalConverted += converted
    totalSkipped += skipped
    if (skipped > 0) failures.push({ filePath, skipped })
  }
}

console.log(`\nTotal: ${totalConverted} converted, ${totalSkipped} skipped`)
if (failures.length) {
  console.log('\nFiles with skipped selects (need manual review):')
  failures.forEach(f => console.log(`  - ${f.filePath.replace(/.*icrm-app[\\/]/, '')} (${f.skipped})`))
}
