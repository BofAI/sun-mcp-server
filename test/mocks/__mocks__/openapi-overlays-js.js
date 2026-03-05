class Overlay {
  static createOverlay(overlay) {
    return new Overlay(overlay);
  }

  constructor(overlay) {
    this.overlay = overlay;
  }

  applyTo(baseSpec) {
    const result = JSON.parse(JSON.stringify(baseSpec));

    if (this.overlay.actions && Array.isArray(this.overlay.actions)) {
      for (const action of this.overlay.actions) {
        if (action.target === '$.info' && action.update) {
          result.info = { ...result.info, ...action.update };
        } else if (action.target.includes("$.paths['/apiv2/pools'].get") && action.update) {
          result.paths['/apiv2/pools'].get = { ...result.paths['/apiv2/pools'].get, ...action.update };
        } else if (action.target.includes("$.paths['/apiv2/price'].get") && action.update) {
          result.paths['/apiv2/price'].get = { ...result.paths['/apiv2/price'].get, ...action.update };
        }
      }
    }

    return result;
  }
}

module.exports = { Overlay };
