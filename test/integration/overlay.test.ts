import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import fs from 'fs/promises';
import { OverlayApplier } from '../../src/overlay-applier';

describe('OpenAPI Overlay Integration Tests (SUN.IO)', () => {
  const specPath = path.resolve(process.cwd(), 'specs/sunio-open-api.json');
  const overlayPath = path.resolve(process.cwd(), 'specs/sunio-overlay.json');

  it('loads SUN.IO base spec and applies overlay', async () => {
    const baseSpec = await SwaggerParser.dereference(specPath);
    expect(baseSpec.info.title).toBe('SUN.IO API v2');

    const overlayJson = JSON.parse(await fs.readFile(overlayPath, 'utf-8'));
    expect(overlayJson.overlay).toBe('1.0.0');
    expect(Array.isArray(overlayJson.actions)).toBe(true);

    const overlayApplier = new OverlayApplier();
    const modifiedSpec = overlayApplier.apply(baseSpec, overlayJson) as any;

    expect(modifiedSpec.info.description).toContain('MCP-oriented descriptions');
    expect(modifiedSpec.paths['/apiv2/pools'].get.summary).toBe('Get SUNSWAP pools with filters');
    expect(modifiedSpec.paths['/apiv2/price'].get.summary).toBe('Get SUNSWAP token prices');
    expect(modifiedSpec.paths['/apiv2/pools'].get['x-mcp'].name).toBe('sunSwapGetPools');
    expect(modifiedSpec.paths['/apiv2/price'].get['x-mcp'].name).toBe('sunSwapGetTokenPrice');
  });
});
