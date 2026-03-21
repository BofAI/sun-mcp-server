/**
 * Mock implementation of the OverlayApplier for testing
 */

class MockOverlayApplier {
  apply(baseSpec: any, overlay: any): any {
    const result = JSON.parse(JSON.stringify(baseSpec))

    if (overlay.actions && Array.isArray(overlay.actions)) {
      for (const action of overlay.actions) {
        if (action.target === '$.info' && action.update) {
          result.info = { ...result.info, ...action.update }
        } else if (action.target.includes("$.paths['/apiv2/pools'].get") && action.update) {
          result.paths['/apiv2/pools'].get = {
            ...result.paths['/apiv2/pools'].get,
            ...action.update,
          }
        } else if (action.target.includes("$.paths['/apiv2/price'].get") && action.update) {
          result.paths['/apiv2/price'].get = {
            ...result.paths['/apiv2/price'].get,
            ...action.update,
          }
        }
      }
    }

    return result
  }

  stringify(obj: any): string {
    return JSON.stringify(obj)
  }

  parseOverlay(text: string): any {
    return JSON.parse(text)
  }

  parseAny(text: string): any {
    return JSON.parse(text)
  }
}

export { MockOverlayApplier as OverlayApplier }
