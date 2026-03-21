import { OverlayApplier } from '../src/overlay-applier'

describe('OverlayApplier parsing', () => {
  let applier: OverlayApplier

  beforeEach(() => {
    applier = new OverlayApplier()
  })

  it('parses JSON overlay objects from strings', () => {
    const overlay = applier.parseOverlay(
      '{"overlay":"1.0.0","info":{"title":"Test","version":"1"},"actions":[]}',
    )

    expect(overlay).toEqual({
      overlay: '1.0.0',
      info: { title: 'Test', version: '1' },
      actions: [],
    })
  })

  it('parses JSON arrays from strings in parseAny', () => {
    const result = applier.parseAny('[{"name":"alpha"},{"name":"beta"}]')

    expect(result).toEqual([{ name: 'alpha' }, { name: 'beta' }])
  })

  it('parses JSON objects with leading whitespace', () => {
    const result = applier.parseAny('\n  {"kind":"object","ok":true}')

    expect(result).toEqual({ kind: 'object', ok: true })
  })

  it('parses JSON arrays with leading whitespace', () => {
    const result = applier.parseAny('\n  [1,2,3]')

    expect(result).toEqual([1, 2, 3])
  })
})
