import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import type { MarkdownAction } from '../utils/markdown'
import { MarkdownToggleController, MARKDOWN_KEYBINDS } from '../utils/markdown-toggles'
import {
  livePreviewExtension,
  wikiLinkClickExtension,
  contactMentionClickExtension,
  setContactNamesEffect,
} from '../codemirror/live-preview'
import { listContinuationExtension } from '../codemirror/markdown-lists'
import { fenceEditorExtension } from '../codemirror/markdown-fences'
import {
  wikiLinkAutocompleteExtension,
  completeWikiLink,
  type WikiLinkContext,
} from '../codemirror/wiki-autocomplete'
import {
  contactAutocompleteExtension,
  completeContactMention,
  type ContactMentionContext,
} from '../codemirror/contact-autocomplete'
import WikiLinkPopup, { buildWikiLinkOptions } from './WikiLinkPopup'
import ContactMentionPopup, { filterContactOptions, type ContactOption } from './ContactMentionPopup'
import '../codemirror/live-preview.css'
import { useTheme } from '../context/ThemeContext'

export interface MarkdownEditorHandle {
  toggleAction: (action: MarkdownAction) => void
  getActiveActions: () => MarkdownAction[]
  focus: () => void
  selectTitle: () => void
  refreshDecorations: () => void
}

interface MarkdownEditorProps {
  documentKey: string | number
  initialValue: string
  onChange: (value: string) => void
  placeholder?: string
  onActiveActionsChange?: (active: MarkdownAction[]) => void
  onWikiLinkClick?: (title: string) => void
  onWikiLinkEnsure?: (title: string) => void
  onContactMentionClick?: (name: string) => void
  wikiLinkEnabled?: boolean
  selectTitleOnMount?: boolean
}

function selectTitleInView(view: EditorView) {
  const firstLine = view.state.doc.line(1)
  const text = firstLine.text
  const headingMatch = text.match(/^#{1,6}\s+(.*)$/)
  const titleText = headingMatch?.[1] ?? text
  if (!titleText.trim()) {
    view.focus()
    return
  }

  const titleStart = headingMatch
    ? firstLine.from + text.indexOf(titleText)
    : firstLine.from
  const titleEnd = titleStart + titleText.length

  view.dispatch({
    selection: { anchor: titleEnd, head: titleStart },
    scrollIntoView: true,
  })
  view.focus()
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      documentKey,
      initialValue,
      onChange,
      placeholder,
      onActiveActionsChange,
      onWikiLinkClick,
      onWikiLinkEnsure,
      onContactMentionClick,
      wikiLinkEnabled = false,
      selectTitleOnMount,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const toggleRef = useRef<MarkdownToggleController | null>(null)
    const onChangeRef = useRef(onChange)
    const onWikiLinkClickRef = useRef(onWikiLinkClick)
    const onWikiLinkEnsureRef = useRef(onWikiLinkEnsure)
    const onContactMentionClickRef = useRef(onContactMentionClick)
    const wikiCtxRef = useRef<WikiLinkContext | null>(null)
    const { theme } = useTheme()

    const [wikiCtx, setWikiCtx] = useState<WikiLinkContext | null>(null)
    const [wikiCoords, setWikiCoords] = useState<{
      top: number
      left: number
      bottom: number
    } | null>(null)
    const [wikiFiles, setWikiFiles] = useState<{ name: string; path: string }[]>([])
    const [wikiLoading, setWikiLoading] = useState(false)

    const [contactCtx, setContactCtx] = useState<ContactMentionContext | null>(null)
    const [contactCoords, setContactCoords] = useState<{
      top: number
      left: number
      bottom: number
    } | null>(null)
    const [allContacts, setAllContacts] = useState<ContactOption[]>([])
    const contactCtxRef = useRef<ContactMentionContext | null>(null)

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      onWikiLinkClickRef.current = onWikiLinkClick
    }, [onWikiLinkClick])

    useEffect(() => {
      onWikiLinkEnsureRef.current = onWikiLinkEnsure
    }, [onWikiLinkEnsure])

    useEffect(() => {
      onContactMentionClickRef.current = onContactMentionClick
    }, [onContactMentionClick])

    useEffect(() => {
      wikiCtxRef.current = wikiCtx
    }, [wikiCtx])

    useEffect(() => {
      toggleRef.current = new MarkdownToggleController((active) => {
        onActiveActionsChange?.(Array.from(active))
      })
    }, [onActiveActionsChange])

    useEffect(() => {
      if (!wikiLinkEnabled || !wikiCtx) return
      let cancelled = false
      setWikiLoading(true)
      void Promise.all([
        window.cortex.storage.listFiles('notes'),
        window.cortex.storage.listFiles('diary'),
      ]).then(([notesFiles, diaryFiles]) => {
        if (cancelled) return
        setWikiFiles([...notesFiles, ...diaryFiles])
        setWikiLoading(false)
      })
      return () => {
        cancelled = true
      }
    }, [wikiLinkEnabled, wikiCtx?.linkFrom])

    // Load contacts when @ mention context opens
    useEffect(() => {
      contactCtxRef.current = contactCtx
    }, [contactCtx])

    useEffect(() => {
      if (!wikiLinkEnabled) return
      let cancelled = false
      void window.cortex.contacts.list().then((contacts) => {
        if (cancelled) return
        setAllContacts(contacts.map((c) => ({ id: c.id, name: c.name })))
      })
      return () => { cancelled = true }
    }, [wikiLinkEnabled, documentKey])

    const editorTheme = useMemo(
      () =>
        EditorView.theme({
          '&': {
            backgroundColor: 'transparent !important',
            color: 'var(--text-primary)',
            height: '100%',
          },
          '.cm-scroller': {
            backgroundColor: 'transparent !important',
            overflow: 'auto',
          },
          '.cm-content': {
            caretColor: 'var(--accent)',
            padding: '16px 32px 24px',
            backgroundColor: 'transparent !important',
          },
          '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: 'var(--accent)',
          },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: 'var(--accent-muted) !important',
          },
          '.cm-gutters': {
            backgroundColor: 'transparent !important',
            color: 'var(--text-muted)',
            border: 'none',
          },
          '.cm-gutter': {
            backgroundColor: 'transparent !important',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'transparent',
          },
          '.cm-activeLine': {
            backgroundColor: 'transparent',
          },
          '.cm-line': {
            color: 'var(--text-primary)',
          },
        }),
      [theme]
    )

    const keymapExt = useMemo(
      () =>
        Prec.highest(
          keymap.of(
            MARKDOWN_KEYBINDS.map(({ key, action }) => ({
              key,
              run: (view) => {
                toggleRef.current?.toggle(view, action)
                return true
              },
            }))
          )
        ),
      []
    )

    const livePreviewExt = useMemo(() => livePreviewExtension(), [])
    const wikiClickExt = useMemo(
      () =>
        wikiLinkClickExtension((title) => {
          onWikiLinkClickRef.current?.(title)
        }),
      []
    )
    const contactClickExt = useMemo(
      () =>
        contactMentionClickExtension((name) => {
          onContactMentionClickRef.current?.(name)
        }),
      []
    )

    const wikiAutoExt = useMemo(
      () =>
        wikiLinkAutocompleteExtension({
          onContextChange: (ctx, view) => {
            setWikiCtx(ctx)
            if (ctx) {
              requestAnimationFrame(() => {
                const coords = view.coordsAtPos(ctx.to)
                if (coords) {
                  setWikiCoords({
                    top: coords.top,
                    left: coords.left,
                    bottom: coords.bottom,
                  })
                }
              })
            } else {
              setWikiCoords(null)
            }
          },
          onLinkCompleted: (title) => {
            onWikiLinkEnsureRef.current?.(title)
          },
        }),
      []
    )

    const contactAutoExt = useMemo(
      () =>
        contactAutocompleteExtension({
          onContextChange: (ctx, view) => {
            setContactCtx(ctx)
            if (ctx) {
              requestAnimationFrame(() => {
                const coords = view.coordsAtPos(ctx.to)
                if (coords) {
                  setContactCoords({
                    top: coords.top,
                    left: coords.left,
                    bottom: coords.bottom,
                  })
                }
              })
            } else {
              setContactCoords(null)
            }
          },
        }),
      []
    )

    const changeListener = useMemo(
      () =>
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          onChangeRef.current(update.state.doc.toString())
        }),
      []
    )

    const extensions = useMemo(
      () => [
        lineNumbers(),
        EditorView.lineWrapping,
        listContinuationExtension(),
        fenceEditorExtension(),
        keymapExt,
        livePreviewExt,
        wikiClickExt,
        contactClickExt,
        ...(wikiLinkEnabled ? [wikiAutoExt, contactAutoExt] : []),
        editorTheme,
        changeListener,
      ],
      [
        keymapExt,
        livePreviewExt,
        wikiClickExt,
        contactClickExt,
        wikiAutoExt,
        contactAutoExt,
        wikiLinkEnabled,
        editorTheme,
        changeListener,
      ]
    )

    useEffect(() => {
      const parent = containerRef.current
      if (!parent) return

      const state = EditorState.create({
        doc: initialValue,
        extensions,
      })

      const view = new EditorView({ state, parent })
      viewRef.current = view

      if (selectTitleOnMount) {
        requestAnimationFrame(() => selectTitleInView(view))
      } else {
        requestAnimationFrame(() => view.focus())
      }

      return () => {
        view.destroy()
        viewRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentKey])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({ effects: setContactNamesEffect.of(allContacts.map((c) => c.name)) })
    }, [allContacts, documentKey])

    const handleWikiSelect = useCallback(
      (opt: { name: string; path: string; isNew?: boolean }) => {
        const view = viewRef.current
        const ctx = wikiCtxRef.current
        if (!view || !ctx) return
        completeWikiLink(view, ctx, opt.name)
        if (opt.isNew) {
          onWikiLinkEnsureRef.current?.(opt.name)
        }
        setWikiCtx(null)
        setWikiCoords(null)
      },
      []
    )

    const handleContactSelect = useCallback(
      (opt: ContactOption) => {
        const view = viewRef.current
        const ctx = contactCtxRef.current
        // Empty id = user dismissed (Escape)
        if (!opt.id) {
          setContactCtx(null)
          setContactCoords(null)
          return
        }
        if (!view || !ctx) return
        completeContactMention(view, ctx, opt.name)
        setContactCtx(null)
        setContactCoords(null)
      },
      []
    )

    useImperativeHandle(ref, () => ({
      toggleAction: (action: MarkdownAction) => {
        if (viewRef.current && toggleRef.current) {
          toggleRef.current.toggle(viewRef.current, action)
        }
      },
      getActiveActions: () => Array.from(toggleRef.current?.getActive() ?? []),
      focus: () => viewRef.current?.focus(),
      selectTitle: () => {
        if (viewRef.current) selectTitleInView(viewRef.current)
      },
      refreshDecorations: () => {
        const view = viewRef.current
        if (!view) return
        view.requestMeasure()
        const pos = view.state.selection.main.head
        view.dispatch({ selection: { anchor: pos, head: pos } })
      },
    }))

    const wikiOptions = useMemo(
      () => (wikiCtx ? buildWikiLinkOptions(wikiFiles, wikiCtx.query) : []),
      [wikiCtx, wikiFiles]
    )

    const contactOptions = useMemo(
      () => (contactCtx ? filterContactOptions(allContacts, contactCtx.query) : []),
      [contactCtx, allContacts]
    )

    return (
      <>
        <div className="markdown-editor-wrap" ref={containerRef} data-placeholder={placeholder} />
        {wikiLinkEnabled && wikiCtx && (
          <WikiLinkPopup
            query={wikiCtx.query}
            options={wikiOptions}
            loading={wikiLoading}
            coords={wikiCoords}
            onSelect={handleWikiSelect}
          />
        )}
        {wikiLinkEnabled && contactCtx && (
          <ContactMentionPopup
            query={contactCtx.query}
            options={contactOptions}
            loading={false}
            coords={contactCoords}
            onSelect={handleContactSelect}
          />
        )}
      </>
    )
  }
)

export default MarkdownEditor
