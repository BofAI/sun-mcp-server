// Mock for openapiProcessor to avoid loading the actual module
import path from 'path';
import fs from 'fs/promises';
import { ProcessedOpenAPI } from '../../src/types';
import { testConfig } from '../fixtures/test-config';

/**
 * Get the processed OpenAPI spec from the test fixture
 */
export async function getProcessedOpenAPI(): Promise<ProcessedOpenAPI> {
  // Load the fixture OpenAPI spec
  const filePath = path.resolve(process.cwd(), testConfig.openApiFile);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// Export the mock function with the same name as the original
export const getProcessedOpenApi = getProcessedOpenAPI;
