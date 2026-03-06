import { getProcessedOpenApi } from '../../src/openapiProcessor';
import path from 'path';
import fs from 'fs/promises';
import { testConfig } from '../fixtures/test-config';
import { jest } from '@jest/globals';

// Define constants
const configPath = '../../src/config';

describe('OpenAPI Processor Integration Tests', () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];
  const fixturesPath = path.resolve(process.cwd(), 'test/fixtures');

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
    // Set up test OpenAPI file path
    process.env.OPENAPI_SPEC_PATH = path.resolve(process.cwd(), testConfig.openApiFile);
    
    // Clear jest module mocks between tests
    jest.resetModules();
    jest.dontMock('../../src/config');
  });

  afterAll(() => {
    // Restore original environment after all tests
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  it('should load and process OpenAPI specification from file', async () => {
    // Explicitly mock config with no overlays for this test
    jest.resetModules();
    
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: path.resolve(process.cwd(), testConfig.openApiFile),
        overlayPaths: [],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        customHeaders: {},
        disableXMcp: false,
        filter: {
          whitelist: null,
          blacklist: [],
        },
      }
    }));
    
    // Import the module with our mocks applied
    const { getProcessedOpenApi: getProcessedOpenApiClean } = require('../../src/openapiProcessor');
    
    const openApiSpec = await getProcessedOpenApiClean();
    
    expect(openApiSpec).toBeDefined();
    expect(openApiSpec.openapi).toBe('3.0.0');
    expect(openApiSpec.info.title).toBe('Petstore API');
    expect(openApiSpec.paths).toBeDefined();
    expect(openApiSpec.paths["/pets"]).toBeDefined();
    expect(openApiSpec.paths["/pets/{petId}"]).toBeDefined();
    expect(openApiSpec.components.schemas.Pet).toBeDefined();
  });

  it('should apply overlay configuration when provided', async () => {
    const overlayFilePath = path.resolve(process.cwd(), 'test/fixtures/petstore-overlay.json');
    
    // Clear any cached modules
    jest.resetModules();
    
    // Read the overlay file contents directly to confirm it has what we expect
    const overlayContent = await fs.readFile(overlayFilePath, 'utf8');
    const overlay = JSON.parse(overlayContent) as {
      overlay: string;
      info: { 
        title: string;
        description: string;
        version: string;
      };
      actions: Array<{
        target: string;
        update?: any;
        remove?: boolean;
      }>;
    };
    
    // Verify this is a proper OpenAPI Overlay Spec 1.0.0 document
    expect(overlay.overlay).toBe('1.0.0');
    expect(overlay.info.title).toBe('Modified Petstore API Overlay');
    expect(overlay.actions).toBeInstanceOf(Array);
    
    // The info.title in the overlay document itself is 'Modified Petstore API Overlay'
    // but the action will update the OpenAPI document title to 'Modified Petstore API'
    const titleUpdateAction = overlay.actions.find(
      action => action.target === '$.info' && action.update?.title === 'Modified Petstore API'
    );
    expect(titleUpdateAction).toBeDefined();
    
    // Mock the config module to include our overlay
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: path.resolve(process.cwd(), testConfig.openApiFile),
        overlayPaths: [overlayFilePath],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        filter: {
          whitelist: null,
          blacklist: [],
        },
      }
    }));
    
    // Import the processor module with our mock config
    const { getProcessedOpenApi: getProcessedOpenApiWithOverlay } = require('../../src/openapiProcessor');
    
    const openApiSpec = await getProcessedOpenApiWithOverlay();
    
    // The overlay should be applied to the spec
    expect(openApiSpec).toBeDefined();
    
    // Verify that the overlay changes were applied based on the actual actions
    // Instead of hardcoded values, we'll check against the actions in the overlay
    const infoAction = overlay.actions.find(a => a.target === '$.info');
    expect(infoAction).toBeDefined();
    expect(openApiSpec.info.title).toBe(infoAction!.update.title);
    expect(openApiSpec.info.version).toBe(infoAction!.update.version);
    
    // Validate path-level overlay changes
    const pathAction = overlay.actions.find(a => a.target === "$.paths['/pets'].get");
    expect(pathAction).toBeDefined();
    expect(openApiSpec.paths["/pets"].get.summary).toBe(pathAction!.update.summary);
    expect(openApiSpec.paths["/pets"].get.description).toBe(pathAction!.update.description);
    
    // Validate parameter overlay changes
    const petIdParam = openApiSpec.paths["/pets/{petId}"].get.parameters.find(
      (p: any) => p.name === 'petId' && p.in === 'path'
    );
    const paramAction = overlay.actions.find(a => a.target.includes('petId'));
    expect(petIdParam).toBeDefined();
    expect(paramAction).toBeDefined();
    expect(petIdParam.description).toBe(paramAction!.update.description);
    expect(petIdParam.schema.type).toBe(paramAction!.update.schema.type);
    expect(petIdParam.schema.format).toBe(paramAction!.update.schema.format);
  });

  it('should throw error for invalid OpenAPI file path', async () => {
    // Mock the config with an invalid file path
    jest.resetModules();
    
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: '/path/to/nonexistent/openapi.json',
        overlayPaths: [],
        mcpPort: 8080,
        targetApiBaseUrl: undefined,
        apiKey: undefined,
        securitySchemeName: undefined,
        securityCredentials: {},
        filter: {
          whitelist: null,
          blacklist: [],
        },
      }
    }));
    
    // Import the processor module with our mocks applied
    const { getProcessedOpenApi: getProcessedOpenApiWithInvalidPath } = require('../../src/openapiProcessor');
    
    // Expect the function to throw an error
    await expect(getProcessedOpenApiWithInvalidPath()).rejects.toThrow();
    
    // Reset mocks
    jest.resetModules();
    jest.dontMock('../../src/config');
  });

  it('should create a valid OpenAPI spec object', async () => {
    // Test that the processed OpenAPI spec has all required properties
    const openApiSpec = await getProcessedOpenApi();
    
    // Check basic structure requirements
    expect(openApiSpec).toHaveProperty('openapi');
    expect(openApiSpec).toHaveProperty('info');
    expect(openApiSpec).toHaveProperty('paths');
    
    // Validate info section
    expect(openApiSpec.info).toHaveProperty('title');
    expect(openApiSpec.info).toHaveProperty('version');
    
    // Validate paths have operations
    // Find at least one valid operation with standard HTTP methods
    let hasValidOperation = false;
    Object.values(openApiSpec.paths).forEach((pathItem: any) => {
      ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
        if (pathItem[method]) hasValidOperation = true;
      });
    });
    expect(hasValidOperation).toBe(true);
    
    // Check that all operations have required fields
    Object.entries(openApiSpec.paths).forEach(([path, pathItem]: [string, any]) => {
      Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          expect(operation).toHaveProperty('operationId');
          expect(operation).toHaveProperty('responses');
        }
      });
    });
  });
});
