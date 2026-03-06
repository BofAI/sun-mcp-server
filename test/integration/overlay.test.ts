import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import fs from 'fs/promises';
import { OverlayApplier } from '../../src/overlay-applier';

describe('OpenAPI Overlay Integration Tests', () => {
  // Path to test files
  const fixturesPath = path.resolve(process.cwd(), 'test/fixtures');
  const petstoreSpecPath = path.resolve(fixturesPath, 'petstore-openapi.json');
  const overlayPath = path.resolve(fixturesPath, 'petstore-overlay.json');

  it('should load base spec and apply overlay using the OverlayApplier', async () => {
    // First load the base OpenAPI spec
    const baseSpec = await SwaggerParser.dereference(petstoreSpecPath);
    
    // Verify the base spec properties before overlay
    expect(baseSpec.info.title).toBe('Petstore API');
    
    // Load the overlay file
    const overlayContent = await fs.readFile(overlayPath, 'utf-8');
    const overlayJson = JSON.parse(overlayContent);
    
    // Verify this is a proper OpenAPI Overlay Spec 1.0.0 document
    expect(overlayJson.overlay).toBe('1.0.0');
    expect(overlayJson.info.title).toBe('Modified Petstore API Overlay');
    expect(overlayJson.actions).toBeInstanceOf(Array);
    
    // Apply the overlay using our real implementation
    const overlayApplier = new OverlayApplier();
    const modifiedSpec = overlayApplier.apply(baseSpec, overlayJson) as any;
    
    // Verify the overlay was applied correctly
    // Note: We're checking for the title in the overlay actions, not the overlay metadata
    const titleAction = overlayJson.actions.find((a: any) => a.target === '$.info' && a.update?.title);
    expect(modifiedSpec.info.title).toBe(titleAction.update.title);
    expect(modifiedSpec.info.description).toBe(titleAction.update.description);
    expect(modifiedSpec.info.version).toBe(titleAction.update.version);
    
    // Verify path-level changes
    const pathAction = overlayJson.actions.find(
      (a: any) => a.target === "$.paths['/pets'].get"
    );
    expect(modifiedSpec.paths["/pets"].get.summary).toBe(pathAction.update.summary);
    expect(modifiedSpec.paths["/pets"].get.description).toBe(pathAction.update.description);
    
    // Verify parameter-level changes
    const petIdParam = modifiedSpec.paths["/pets/{petId}"].get.parameters.find(
      (p: any) => p.name === 'petId' && p.in === 'path'
    );
    const paramAction = overlayJson.actions.find(
      (a: any) => a.target.includes('petId')
    );
    expect(petIdParam).toBeDefined();
    expect(petIdParam.description).toBe(paramAction.update.description);
    expect(petIdParam.schema.type).toBe(paramAction.update.schema.type);
    expect(petIdParam.schema.format).toBe(paramAction.update.schema.format);
  });
});
