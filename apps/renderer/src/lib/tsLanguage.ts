import * as monaco from 'monaco-editor'
import { useWorkbench } from '../store/useWorkbench'

const boundPaths = new WeakMap<monaco.editor.ITextModel, string>()
let installed = false
let opener: monaco.IDisposable | undefined

export function bindTsModel(model: monaco.editor.ITextModel, path: string): void {
  boundPaths.set(model, path)
}

function pathOf(model: monaco.editor.ITextModel): string {
  return boundPaths.get(model) || decodeURIComponent(model.uri.path)
}

function request(model: monaco.editor.ITextModel, position?: monaco.Position) {
  return {
    path: pathOf(model),
    text: model.getValue(),
    line: position?.lineNumber || 1,
    column: position?.column || 1
  }
}

function range(row: {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}): monaco.Range {
  return new monaco.Range(row.startLine, row.startColumn, row.endLine, row.endColumn)
}

function openerLine(sel?: monaco.IRange | monaco.IPosition): number {
  if (!sel) return 1
  if ('startLineNumber' in sel) return Math.max(1, sel.startLineNumber)
  return Math.max(1, sel.lineNumber)
}

function uriPath(resource: monaco.Uri): string {
  return resource.scheme === 'file' ? resource.fsPath : decodeURIComponent(resource.path)
}

function completionKind(kind: string): monaco.languages.CompletionItemKind {
  if (/method|function|construct|call/i.test(kind)) return monaco.languages.CompletionItemKind.Function
  if (/class/i.test(kind)) return monaco.languages.CompletionItemKind.Class
  if (/interface/i.test(kind)) return monaco.languages.CompletionItemKind.Interface
  if (/enum/i.test(kind)) return monaco.languages.CompletionItemKind.Enum
  if (/module/i.test(kind)) return monaco.languages.CompletionItemKind.Module
  if (/property|member/i.test(kind)) return monaco.languages.CompletionItemKind.Property
  if (/keyword/i.test(kind)) return monaco.languages.CompletionItemKind.Keyword
  return monaco.languages.CompletionItemKind.Variable
}

function symbolKind(kind: string): monaco.languages.SymbolKind {
  if (/method|function|construct|call/i.test(kind)) return monaco.languages.SymbolKind.Function
  if (/class/i.test(kind)) return monaco.languages.SymbolKind.Class
  if (/interface/i.test(kind)) return monaco.languages.SymbolKind.Interface
  if (/enum/i.test(kind)) return monaco.languages.SymbolKind.Enum
  if (/module/i.test(kind)) return monaco.languages.SymbolKind.Module
  if (/property|member/i.test(kind)) return monaco.languages.SymbolKind.Property
  return monaco.languages.SymbolKind.Variable
}

export function ensureTsLanguageProviders(): void {
  if (installed) return
  installed = true
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true
  })
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true
  })
  opener ||= monaco.editor.registerEditorOpener({
    openCodeEditor(_source, resource, selection) {
      const path = uriPath(resource)
      if (!path || path.includes('\0')) return false
      void useWorkbench.getState().openFile(path).then(() => {
        useWorkbench.setState({ outlineJump: { path, line: openerLine(selection) } })
      })
      return true
    }
  })

  for (const language of ['typescript', 'javascript']) {
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.', '"', "'", '/', '@', '<'],
      provideCompletionItems: async (model, position, _context, token) => {
        try {
          const rows = await window.homeai.tsCompletions(request(model, position))
          if (token.isCancellationRequested) return { suggestions: [] }
          const word = model.getWordUntilPosition(position)
          const editRange = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
          return {
            suggestions: rows.map((row) => ({
              label: row.label,
              insertText: row.insertText,
              sortText: row.sortText,
              detail: row.source,
              kind: completionKind(row.kind),
              range: editRange
            }))
          }
        } catch {
          return { suggestions: [] }
        }
      }
    })

    monaco.languages.registerHoverProvider(language, {
      provideHover: async (model, position, token) => {
        try {
          const row = await window.homeai.tsHover(request(model, position))
          if (!row || token.isCancellationRequested) return null
          return {
            range: range(row),
            contents: [
              { value: `\`\`\`typescript\n${row.display.replace(/```/g, '')}\n\`\`\`` },
              { value: (row.documentation || '').replace(/[<>]/g, '') }
            ]
          }
        } catch {
          return null
        }
      }
    })

    monaco.languages.registerDefinitionProvider(language, {
      provideDefinition: async (model, position, token) => {
        try {
          const rows = await window.homeai.tsDefinition(request(model, position))
          return token.isCancellationRequested ? [] : rows.map((row) => ({ uri: monaco.Uri.file(row.path), range: range(row) }))
        } catch {
          return []
        }
      }
    })

    monaco.languages.registerReferenceProvider(language, {
      provideReferences: async (model, position, _context, token) => {
        try {
          const rows = await window.homeai.tsReferences(request(model, position))
          return token.isCancellationRequested ? [] : rows.map((row) => ({ uri: monaco.Uri.file(row.path), range: range(row) }))
        } catch {
          return []
        }
      }
    })

    monaco.languages.registerDocumentSymbolProvider(language, {
      provideDocumentSymbols: async (model, token) => {
        try {
          const rows = await window.homeai.tsSymbols(request(model))
          return token.isCancellationRequested ? [] : rows.map((row) => ({
            name: row.name,
            detail: row.container,
            kind: symbolKind(row.kind),
            range: range(row),
            selectionRange: range(row),
            tags: []
          }))
        } catch {
          return []
        }
      }
    })

    monaco.languages.registerDocumentFormattingEditProvider(language, {
      provideDocumentFormattingEdits: async (model, _options, token) => {
        try {
          const rows = await window.homeai.tsFormat(request(model))
          return token.isCancellationRequested ? [] : rows.map((row) => ({ range: range(row), text: row.text }))
        } catch {
          return []
        }
      }
    })

    monaco.languages.registerRenameProvider(language, {
      provideRenameEdits: async (model, position, newName, token) => {
        try {
          const result = await window.homeai.tsRename({ ...request(model, position), newName })
          if (token.isCancellationRequested) return { edits: [] }
          useWorkbench.setState({ renamePreview: result.edits })
          await useWorkbench.getState().refreshPending()
          return { edits: [] }
        } catch (error) {
          return { edits: [], rejectReason: error instanceof Error ? error.message : 'Symbol cannot be renamed' }
        }
      },
      resolveRenameLocation: async (model, position) => {
        const word = model.getWordAtPosition(position)
        return word
          ? { range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn), text: word.word }
          : { range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column), text: '' }
      }
    })
  }
}
