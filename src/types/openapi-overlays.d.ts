declare module 'openapi-overlays-js/src/overlay.js' {
  export function applyOverlay(definition: any, overlay: any): any;
  export function overlayFiles(openapiFile: string, overlayFile: string): string;
}

declare module 'openapi-overlays-js' {
  // This module appears to be a CLI tool and doesn't export the Overlayer class as expected
  // The actual functionality is in the src/overlay.js file
}
