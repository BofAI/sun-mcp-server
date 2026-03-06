/**
 * HTTP fetching tests without opening local sockets.
 * We mock fetchFromUrl to keep tests deterministic in sandboxed CI.
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';

describe('HTTP Fetching Tests', () => {
  const specUrl = 'https://fixtures.local/petstore-openapi.json';
  const overlayUrl = 'https://fixtures.local/petstore-overlay.json';
  let specContent = '';
  let overlayContent = '';

  beforeAll(async () => {
    const specPath = path.resolve(process.cwd(), 'test/fixtures/petstore-openapi.json');
    const overlayPath = path.resolve(process.cwd(), 'test/fixtures/petstore-overlay.json');
    specContent = await fs.readFile(specPath, 'utf8');
    overlayContent = await fs.readFile(overlayPath, 'utf8');
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it('should fetch OpenAPI spec via HTTP URL', async () => {
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: specUrl,
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
      },
    }));

    jest.doMock('../../src/utils/httpClient', () => ({
      isHttpUrl: (value: string) => value.startsWith('http://') || value.startsWith('https://'),
      fetchFromUrl: jest.fn(async (url: string) => {
        if (url === specUrl) return specContent;
        throw new Error(`Unexpected URL: ${url}`);
      }),
    }));

    const { getProcessedOpenApi } = require('../../src/openapiProcessor');
    const openApiSpec = await getProcessedOpenApi();

    expect(openApiSpec).toBeDefined();
    expect(openApiSpec.openapi).toBe('3.0.0');
    expect(openApiSpec.info.title).toBe('Petstore API');
    expect(openApiSpec.paths['/pets']).toBeDefined();
    expect(openApiSpec.paths['/pets/{petId}']).toBeDefined();
  });

  it('should fetch overlay via HTTP URL', async () => {
    const localSpecPath = path.resolve(process.cwd(), 'test/fixtures/petstore-openapi.json');

    jest.doMock('../../src/config', () => ({
      config: {
        specPath: localSpecPath,
        overlayPaths: [overlayUrl],
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
      },
    }));

    jest.doMock('../../src/utils/httpClient', () => ({
      isHttpUrl: (value: string) => value.startsWith('http://') || value.startsWith('https://'),
      fetchFromUrl: jest.fn(async (url: string) => {
        if (url === overlayUrl) return overlayContent;
        throw new Error(`Unexpected URL: ${url}`);
      }),
    }));

    const { getProcessedOpenApi } = require('../../src/openapiProcessor');
    const openApiSpec = await getProcessedOpenApi();

    expect(openApiSpec).toBeDefined();
    expect(openApiSpec.info.title).toBe('Modified Petstore API');
    expect(openApiSpec.paths['/pets'].get.summary).toBe('List all pets with overlay');
    const petIdParam = openApiSpec.paths['/pets/{petId}'].get.parameters.find(
      (p: any) => p.name === 'petId' && p.in === 'path',
    );
    expect(petIdParam).toBeDefined();
    expect(petIdParam.description).toBe('Enhanced pet ID description from overlay');
  });

  it('should fetch both spec and overlay via HTTP URL', async () => {
    jest.doMock('../../src/config', () => ({
      config: {
        specPath: specUrl,
        overlayPaths: [overlayUrl],
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
      },
    }));

    jest.doMock('../../src/utils/httpClient', () => ({
      isHttpUrl: (value: string) => value.startsWith('http://') || value.startsWith('https://'),
      fetchFromUrl: jest.fn(async (url: string) => {
        if (url === specUrl) return specContent;
        if (url === overlayUrl) return overlayContent;
        throw new Error(`Unexpected URL: ${url}`);
      }),
    }));

    const { getProcessedOpenApi } = require('../../src/openapiProcessor');
    const openApiSpec = await getProcessedOpenApi();

    expect(openApiSpec).toBeDefined();
    expect(openApiSpec.openapi).toBe('3.0.0');
    expect(openApiSpec.info.title).toBe('Modified Petstore API');
    expect(openApiSpec.paths['/pets']).toBeDefined();
    expect(openApiSpec.paths['/pets'].get.summary).toBe('List all pets with overlay');
  });
});
