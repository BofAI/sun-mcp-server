import SwaggerParser from "@apidevtools/swagger-parser";
import { OverlayApplier } from "./overlay-applier";
import fs from "fs/promises";
import path from "path";
import YAML from "js-yaml";
import { config } from "./config";
import { isHttpUrl, fetchFromUrl } from "./utils/httpClient";
import type { SpecConfig } from "./config";

/**
 * Validates an OpenAPI specification for required elements
 * @param api The OpenAPI specification object
 * @throws Error if validation fails
 */
function validateOpenApiSpec(api: any): void {
  // Check for basic required OpenAPI elements
  if (!api) {
    throw new Error("OpenAPI specification is null or undefined");
  }

  if (!api.openapi) {
    throw new Error(
      "Missing OpenAPI version identifier. This doesn't appear to be a valid OpenAPI spec.",
    );
  }

  if (!api.info) {
    throw new Error("Missing info section in OpenAPI spec");
  }

  if (!api.paths || Object.keys(api.paths).length === 0) {
    throw new Error(
      "No paths defined in OpenAPI spec. There are no operations to expose as tools.",
    );
  }

  // Validate that at least one path has valid operations
  let hasValidOperation = false;
  const httpMethods = ["get", "post", "put", "delete", "patch", "options", "head", "trace"];

  Object.keys(api.paths).forEach((path) => {
    const pathItem = api.paths[path];
    if (!pathItem) return;

    Object.keys(pathItem).forEach((key) => {
      if (httpMethods.includes(key.toLowerCase())) {
        const operation = pathItem[key];
        if (operation) {
          hasValidOperation = true;
        }
      }
    });
  });

  if (!hasValidOperation) {
    throw new Error("No valid operations found in any path. Cannot create tools.");
  }

  console.error("OpenAPI specification validation passed");
}

async function loadSpec(filePath: string): Promise<any> {
  console.error(`Loading OpenAPI spec from: ${filePath}`);
  try {
    let api;

    // Handle HTTP URLs
    if (isHttpUrl(filePath)) {
      console.error(`Detected HTTP URL for spec: ${filePath}`);
      // Use our custom HTTP client instead of letting SwaggerParser handle URLs
      const content = await fetchFromUrl(filePath);
      // Parse the content based on file extension
      if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
        api = YAML.load(content);
      } else {
        api = JSON.parse(content);
      }

      // Manually resolve any references
      api = await SwaggerParser.dereference(api);
    } else {
      // Use SwaggerParser for local files
      api = await SwaggerParser.dereference(filePath);
    }

    console.error(
      `Successfully loaded and dereferenced spec: ${api.info.title} v${api.info.version}`,
    );

    // Additional validation beyond what SwaggerParser does
    validateOpenApiSpec(api);

    return api;
  } catch (err: any) {
    console.error(`Error loading/parsing OpenAPI spec: ${filePath}`, err.message);
    throw err;
  }
}

/**
 * Validates an OpenAPI overlay file structure according to OpenAPI Overlay Specification 1.0.0
 * @param overlay The overlay object to validate
 * @returns True if valid, throws error otherwise
 */
function validateOverlay(overlay: any): boolean {
  if (!overlay) {
    throw new Error("Overlay is null or undefined");
  }

  // Check if it's a formal OpenAPI Overlay (should have overlay property)
  if (overlay.overlay) {
    // Validate formal overlay structure per spec
    if (typeof overlay.overlay !== "string") {
      throw new Error('Overlay version must be a string (e.g., "1.0.0")');
    }

    // Check for required info section
    if (!overlay.info || typeof overlay.info !== "object") {
      throw new Error("Formal overlay is missing info object");
    }

    if (!overlay.info.title || !overlay.info.version) {
      throw new Error("Overlay info must contain title and version");
    }

    // Check for actions array
    if (!overlay.actions || !Array.isArray(overlay.actions)) {
      throw new Error("Formal overlay must have an actions array");
    }

    // Validate each action
    for (const action of overlay.actions) {
      if (!action.target) {
        throw new Error("Each action must have a target JSONPath");
      }

      // An action must have either update or remove property
      if (action.remove === undefined && action.update === undefined) {
        throw new Error("Each action must have either update or remove property");
      }

      if (action.remove !== undefined && typeof action.remove !== "boolean") {
        throw new Error("Action remove property must be a boolean");
      }
    }
  } else {
    // For legacy/simple overlays without the formal structure,
    // verify that it has some properties that could modify an OpenAPI spec
    console.error(
      "Warning: Using legacy overlay format, not compliant with OpenAPI Overlay Specification 1.0.0",
    );

    const hasValidProperties =
      overlay.info || overlay.paths || overlay.components || overlay.tags || overlay.servers;

    if (!hasValidProperties) {
      throw new Error("Overlay doesn't contain any valid OpenAPI modification properties");
    }
  }

  return true;
}

async function loadOverlay(filePath: string): Promise<any> {
  console.error(`Loading overlay file: ${filePath}`);
  try {
    let content: string;

    if (isHttpUrl(filePath)) {
      // Fetch overlay from HTTP URL
      content = await fetchFromUrl(filePath);
    } else {
      // Load overlay from local file system
      content = await fs.readFile(filePath, "utf-8");
    }

    const ext = path.extname(filePath).toLowerCase();
    let overlay;

    if (ext === ".yaml" || ext === ".yml") {
      overlay = YAML.load(content);
    } else if (ext === ".json") {
      overlay = JSON.parse(content);
    } else {
      throw new Error(`Unsupported overlay file extension: ${ext}`);
    }

    // Validate the overlay structure
    validateOverlay(overlay);

    return overlay;
  } catch (err: any) {
    console.error(`Error loading overlay file ${filePath}:`, err.message);
    throw err;
  }
}

export async function getProcessedOpenApi(specConfig?: SpecConfig): Promise<any> {
  const defaultSpecConfig: SpecConfig = {
    specPath: config.specPath,
    overlayPaths: config.overlayPaths || [],
    targetApiBaseUrl: config.targetApiBaseUrl || undefined,
    requestTimeoutMs: config.requestTimeoutMs,
    customHeaders: config.customHeaders || {},
    disableXMcp: config.disableXMcp ?? false,
    filter: config.filter || { whitelist: null, blacklist: [] },
  };
  const selectedSpec = specConfig || config.specConfigs?.[0] || defaultSpecConfig;
  let baseApi = await loadSpec(selectedSpec.specPath);

  if (selectedSpec.overlayPaths.length > 0) {
    console.error(`Applying overlays...`);

    // Apply each overlay sequentially
    for (const overlayPath of selectedSpec.overlayPaths) {
      try {
        // Load the overlay
        const overlayJson = await loadOverlay(overlayPath);

        // Apply the overlay using the OverlayApplier instance
        const overlayApplier = new OverlayApplier();
        baseApi = overlayApplier.apply(baseApi, overlayJson);

        console.error(`Applied overlay: ${overlayPath}`);
      } catch (err) {
        // Decide whether to continue or fail on overlay error
        console.error(`Failed to apply overlay ${overlayPath}. Continuing without it.`, err);
        // throw err; // Or re-throw to stop the process
      }
    }
    console.error("Overlays applied successfully.");
  }

  // Ensure servers are present if needed and targetApiBaseUrl isn't set
  if (!selectedSpec.targetApiBaseUrl && (!baseApi.servers || baseApi.servers.length === 0)) {
    console.error(
      "Warning: No targetApiBaseUrl configured and OpenAPI spec has no servers defined.",
    );
    // Potentially throw an error if a base URL is absolutely required
    throw new Error(
      "Cannot determine target API URL. Either configure targetApiBaseUrl or ensure OpenAPI spec includes servers.",
    );
  } else if (!selectedSpec.targetApiBaseUrl) {
    console.error(`Using server URL from OpenAPI spec: ${baseApi.servers[0].url}`);
  }

  return baseApi;
}
