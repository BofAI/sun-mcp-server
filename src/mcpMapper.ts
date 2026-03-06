import type { JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from 'json-schema';
import type { OpenAPIV3 } from 'openapi-types';
import type { ProcessedOpenAPI, MappedTool, ApiCallDetails, McpToolDefinition } from './types';
import { config } from './config';
import { minimatch } from 'minimatch';

interface MapperOptions {
    targetApiBaseUrl?: string;
    requestTimeoutMs?: number;
    customHeaders?: Record<string, string>;
    disableXMcp?: boolean;
    filter?: {
        whitelist: string[] | null;
        blacklist: string[];
    };
    toolPrefix?: string;
}

// Enhanced mapping from OpenAPI type/format to JSON Schema type
// Now preserves format information
function mapOpenApiTypeToJsonSchemaType(openApiSchema?: OpenAPIV3.SchemaObject): { type: JSONSchema7TypeName | undefined, format?: string, nullable?: boolean } {
    if (!openApiSchema || !openApiSchema.type) return { type: 'string' }; // Default to string if type is missing
    
    // Handle nullable types
    const nullable = openApiSchema.nullable === true;
    
    // Extract base type and format
    const { type, format } = openApiSchema;
    let jsonType: JSONSchema7TypeName | undefined;
    
    switch (type) {
        case 'integer': jsonType = 'integer'; break;
        case 'number': jsonType = 'number'; break;
        case 'boolean': jsonType = 'boolean'; break;
        case 'string': jsonType = 'string'; break;
        case 'array': jsonType = 'array'; break;
        case 'object': jsonType = 'object'; break;
        default:
            console.error(`Unsupported OpenAPI type: ${type}. Defaulting to string.`);
            jsonType = 'string';
    }
    
    return { type: jsonType, format, nullable };
}

// Convert OpenAPI Schema Object to JSON Schema
// Enhanced to handle nullable types and preserve formats
function openApiSchemaToJsonSchema(openApiSchema?: OpenAPIV3.SchemaObject): JSONSchema7 | undefined {
    if (!openApiSchema) return undefined;

    const jsonSchema: JSONSchema7 = {};
    const { type, format, nullable } = mapOpenApiTypeToJsonSchemaType(openApiSchema);

    // Handle nullable types by making it a union type
    if (nullable) {
        // JSON Schema 7 supports type arrays for union types
        jsonSchema.type = [type, 'null'] as any; // Using 'any' to bypass TypeScript's type checking
    } else {
        jsonSchema.type = type;
    }

    // Preserve format if available
    if (format) {
        jsonSchema.format = format;
    }

    // Map descriptions and metadata
    if (openApiSchema.description) {
        jsonSchema.description = openApiSchema.description;
    }
    if (openApiSchema.default !== undefined) {
        jsonSchema.default = openApiSchema.default;
    }
    if (openApiSchema.enum) {
        jsonSchema.enum = openApiSchema.enum;
    }
    if (openApiSchema.example !== undefined) {
        // Store example as an annotation
        (jsonSchema as any).example = openApiSchema.example;
    }

    // Map constraints
    if (typeof openApiSchema.minimum === 'number') {
        jsonSchema.minimum = openApiSchema.minimum;
    }
    if (typeof openApiSchema.maximum === 'number') {
        jsonSchema.maximum = openApiSchema.maximum;
    }
    if (typeof openApiSchema.minLength === 'number') {
        jsonSchema.minLength = openApiSchema.minLength;
    }
    if (typeof openApiSchema.maxLength === 'number') {
        jsonSchema.maxLength = openApiSchema.maxLength;
    }
    if (openApiSchema.pattern) {
        jsonSchema.pattern = openApiSchema.pattern;
    }
    // Add multipleOf constraint
    if (typeof openApiSchema.multipleOf === 'number') {
        jsonSchema.multipleOf = openApiSchema.multipleOf;
    }
    // Add array constraints
    if (typeof openApiSchema.minItems === 'number') {
        jsonSchema.minItems = openApiSchema.minItems;
    }
    if (typeof openApiSchema.maxItems === 'number') {
        jsonSchema.maxItems = openApiSchema.maxItems;
    }
    if (typeof openApiSchema.uniqueItems === 'boolean') {
        jsonSchema.uniqueItems = openApiSchema.uniqueItems;
    }

    // Handle object properties
    if (openApiSchema.type === 'object' && openApiSchema.properties) {
        jsonSchema.properties = {};
        for (const propName in openApiSchema.properties) {
            const propSchema = openApiSchema.properties[propName];
            if (isSchemaObject(propSchema)) { 
                jsonSchema.properties[propName] = safeJsonSchema(openApiSchemaToJsonSchema(propSchema));
            } else {
                console.error(`Skipping non-schema property or reference: ${propName}`);
            }
        }
        if (openApiSchema.required) {
            jsonSchema.required = openApiSchema.required;
        }
        
        // Handle additionalProperties
        if (openApiSchema.additionalProperties !== undefined) {
            if (openApiSchema.additionalProperties === true) {
                jsonSchema.additionalProperties = true;
            } else if (openApiSchema.additionalProperties === false) {
                jsonSchema.additionalProperties = false;
            } else if (isSchemaObject(openApiSchema.additionalProperties)) {
                jsonSchema.additionalProperties = safeJsonSchema(openApiSchemaToJsonSchema(openApiSchema.additionalProperties));
            }
        }
    }

    // Handle array items
    if (openApiSchema.type === 'array' && openApiSchema.items) {
        if (isSchemaObject(openApiSchema.items)) { 
            jsonSchema.items = safeJsonSchema(openApiSchemaToJsonSchema(openApiSchema.items));
        } else {
            console.error(`Skipping non-schema array item or reference.`);
        }
    }

    // Copy extensions (x-... properties)
    Object.keys(openApiSchema).forEach(key => {
        if (key.startsWith('x-')) {
            (jsonSchema as any)[key] = openApiSchema[key as keyof OpenAPIV3.SchemaObject];
        }
    });

    return jsonSchema;
}

/**
 * Checks if an operation matches the whitelist or blacklist patterns
 * @param operationId The operation ID to check
 * @param path The URL path of the operation
 * @param method The HTTP method of the operation
 * @returns true if the operation should be included, false otherwise
 */
function shouldIncludeOperation(
    operationId: string | undefined,
    path: string,
    method: string,
    filter: { whitelist: string[] | null; blacklist: string[] }
): boolean {
    const urlPattern = `${method.toUpperCase()}:${path}`;

    // If whitelist is enabled, include only operations that match a whitelist pattern
    if (filter.whitelist) {
        return filter.whitelist.some((pattern: string) => {
            // Check if pattern matches operationId (if it exists)
            if (operationId && minimatch(operationId, pattern)) {
                return true;
            }
            // Check if pattern matches urlPattern (method:path)
            return minimatch(urlPattern, pattern);
        });
    }
    
    // If only blacklist is enabled, exclude operations that match a blacklist pattern
    if (filter.blacklist.length > 0) {
        return !filter.blacklist.some((pattern: string) => {
            // Check if pattern matches operationId (if it exists)
            if (operationId && minimatch(operationId, pattern)) {
                return true;
            }
            // Check if pattern matches urlPattern (method:path)
            return minimatch(urlPattern, pattern);
        });
    }
    
    // If no filtering is enabled, include all operations
    return true;
}

export function mapOpenApiToMcpTools(openapi: ProcessedOpenAPI, options?: MapperOptions): MappedTool[] {
    const mappedTools: MappedTool[] = [];
    const globalSecurity = openapi.security || null; // Global security requirements
    const securitySchemes = openapi.components?.securitySchemes || undefined; // Security scheme definitions
    const effectiveFilter = options?.filter || config.filter;

    if (!openapi.paths) {
        console.error("OpenAPI spec has no paths defined.");
        return [];
    }

    // Determine the base server URL
    // Priority: Configured URL > First Server URL > Error/Default
    let baseServerUrl = options?.targetApiBaseUrl ?? config.targetApiBaseUrl;
    if (!baseServerUrl) {
        // Extract URL template from servers, defaulting to '/' if not found
        baseServerUrl = openapi.servers?.[0]?.url ?? '/';
    }
    // Ensure it's not undefined before using replace
    baseServerUrl = (baseServerUrl || '/').replace(/\/$/, '');

    for (const path in openapi.paths) {
        const pathItem = openapi.paths[path] as OpenAPIV3.PathItemObject; // Assuming dereferenced

        for (const method in pathItem) {
            // Check if the method is a valid HTTP method
            if (!['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].includes(method.toLowerCase())) {
                continue;
            }

            const operation = pathItem[method as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;
            if (!operation || typeof operation !== 'object') continue;


            const operationId = operation.operationId;

            // --- Filtering ---
            if (!shouldIncludeOperation(operationId, path, method, effectiveFilter)) {
                // If operationId is available, log it for better debugging
                if (operationId) {
                    console.error(`Skipping operation ${operationId} (${method.toUpperCase()} ${path}) due to filter rules.`);
                } else {
                    console.error(`Skipping operation ${method.toUpperCase()} ${path} due to filter rules.`);
                }
                continue;
            }

            // Skip operations without operationId as we need it for the tool name
            if (!operationId) {
                console.error(`Skipping operation ${method.toUpperCase()} ${path} due to missing operationId.`);
                continue;
            }

            // --- Mapping ---
            let toolName = operationId;
            if (options?.toolPrefix) {
                toolName = `${options.toolPrefix}${toolName}`;
            }
            
            // Check for custom MCP extensions at the operation level first, then path level
            const operationMcpExtension = (operation as any)['x-mcp'];
            const pathMcpExtension = (pathItem as any)['x-mcp'];
            
            // Priority: Operation-level extension > Path-level extension > Default
            if (operationMcpExtension && typeof operationMcpExtension === 'object') {
                if (operationMcpExtension.name && typeof operationMcpExtension.name === 'string') {
                    toolName = operationMcpExtension.name;
                }
            } else if (pathMcpExtension && typeof pathMcpExtension === 'object') {
                if (pathMcpExtension.name && typeof pathMcpExtension.name === 'string') {
                    toolName = pathMcpExtension.name;
                }
            }

            let toolDescription = operation.description || operation.summary || pathItem.summary || 'No description available.';
            
            // Check for custom description in MCP extension - operation level first, then path level
            if (operationMcpExtension && typeof operationMcpExtension === 'object') {
                if (operationMcpExtension.description && typeof operationMcpExtension.description === 'string') {
                    toolDescription = operationMcpExtension.description;
                }
            } else if (pathMcpExtension && typeof pathMcpExtension === 'object') {
                if (pathMcpExtension.description && typeof pathMcpExtension.description === 'string') {
                    toolDescription = pathMcpExtension.description;
                }
            }

            // --- Input Schema ---
            const inputJsonSchema: JSONSchema7 = {
                type: 'object',
                properties: {},
                required: [],
            };

            const allParameters: OpenAPIV3.ParameterObject[] = [
                ...(pathItem.parameters || []), // Parameters defined at path level
                ...(operation.parameters || []), // Parameters defined at operation level
            ].filter(isParameterObject); // Ensure they are actual parameter objects

            // Group parameters by their location (path, query, header, cookie)
            const parametersByLocation: Record<string, OpenAPIV3.ParameterObject[]> = {};
            for (const param of allParameters) {
                const location = param.in || 'query'; // Default to query if not specified
                if (!parametersByLocation[location]) {
                    parametersByLocation[location] = [];
                }
                parametersByLocation[location].push(param);
            }
            
            // Create separate property for each parameter location group for better organization
            for (const [location, params] of Object.entries(parametersByLocation)) {
                // If there are parameters in this location, create a property for them
                if (params.length > 0 && inputJsonSchema.properties) {
                    // Process each parameter within its location group
                    for (const param of params) {
                        if (param.name && param.schema && inputJsonSchema.properties) {
                            // Convert OpenAPI schema to JSON Schema
                            const paramSchema = openApiSchemaToJsonSchema(param.schema as OpenAPIV3.SchemaObject);
                            
                            if (paramSchema) {
                                // Add parameter to properties
                                inputJsonSchema.properties[param.name] = paramSchema;
                                
                                // Add description if available
                                if (param.description) {
                                    (inputJsonSchema.properties[param.name] as JSONSchema7).description = param.description;
                                }
                                
                                // Add parameter location metadata as an annotation
                                (inputJsonSchema.properties[param.name] as any)['x-parameter-location'] = location;
                                
                                // Add deprecated flag if needed
                                if (param.deprecated) {
                                    (inputJsonSchema.properties[param.name] as any).deprecated = true;
                                }
                                
                                // Add example if available
                                if (param.example !== undefined) {
                                    (inputJsonSchema.properties[param.name] as any).example = param.example;
                                }
                                
                                // Handle required parameters
                                if (param.required && inputJsonSchema.required) {
                                    inputJsonSchema.required.push(param.name);
                                }
                                
                                // Add any extensions (x-... properties)
                                Object.keys(param).forEach(key => {
                                    if (key.startsWith('x-')) {
                                        (inputJsonSchema.properties![param.name] as any)[key] = param[key as keyof OpenAPIV3.ParameterObject];
                                    }
                                });
                            }
                        }
                    }
                }
            }

            // Handle Request Body
            if (isRequestBodyObject(operation.requestBody)) {
                // Look for application/json content first, fall back to any available content type
                const jsonContent = operation.requestBody.content?.['application/json']?.schema;
                const anyContent = Object.values(operation.requestBody.content || {})[0]?.schema;
                const requestBodySchema = jsonContent || anyContent;

                if (isSchemaObject(requestBodySchema)) {
                    // Convert request body schema and add it to input schema
                    const convertedSchema = openApiSchemaToJsonSchema(requestBodySchema);
                    
                    if (convertedSchema && inputJsonSchema.properties) {
                        // Add as 'requestBody' property
                        inputJsonSchema.properties['requestBody'] = convertedSchema;
                        
                        // Mark as required if specified
                        if (operation.requestBody.required && inputJsonSchema.required) {
                            inputJsonSchema.required.push('requestBody');
                        }
                        
                        // Add description if available
                        if (operation.requestBody.description && inputJsonSchema.properties['requestBody']) {
                            inputJsonSchema.properties['requestBody'].description = operation.requestBody.description;
                        }
                        
                        // Add content type annotation
                        const contentTypes = Object.keys(operation.requestBody.content || {});
                        if (contentTypes.length > 0) {
                            (inputJsonSchema.properties['requestBody'] as any)['x-content-types'] = contentTypes;
                        }
                    }
                }
            }

            // Remove empty required array if nothing is required
            if (inputJsonSchema.required?.length === 0) {
                delete inputJsonSchema.required;
            }

            // --- Output Schema (Primary Success Response, e.g., 200) ---
            let outputJsonSchema: JSONSchema7 | undefined = undefined;
            const successResponseCode = Object.keys(operation.responses || {}).find(code => code.startsWith('2')); // Find first 2xx response
            if (successResponseCode) {
                const response = operation.responses?.[successResponseCode];
                if (isResponseObject(response)) {
                    const jsonContent = response.content?.['application/json']?.schema;
                    if (isSchemaObject(jsonContent)) {
                        const tempSchema = openApiSchemaToJsonSchema(jsonContent);
                        outputJsonSchema = tempSchema as JSONSchema7; // Cast to JSONSchema7 since we know it's a schema
                        if(outputJsonSchema && response.description){
                            outputJsonSchema.description = response.description; // Add response description
                        }
                    }
                }
            }

            // --- Assemble MCP Tool Definition ---
            const mcpDefinition: McpToolDefinition = {
                name: toolName,
                description: toolDescription,
                inputSchema: inputJsonSchema,
                outputSchema: outputJsonSchema, // Properly include the outputSchema
                annotations: {
                    // Add any relevant annotations, e.g., from spec extensions
                    'x-openapi-path': path,
                    'x-openapi-method': method.toUpperCase(),
                }
            };

            // --- Assemble API Call Details ---
            const apiDetails: ApiCallDetails = {
                method: method.toUpperCase(),
                pathTemplate: path,
                serverUrl: baseServerUrl, // Use the determined base URL
                requestTimeoutMs: options?.requestTimeoutMs ?? config.requestTimeoutMs,
                customHeaders: options?.customHeaders ?? config.customHeaders,
                disableXMcp: options?.disableXMcp ?? config.disableXMcp,
                parameters: allParameters, // Store original params for mapping back
                requestBody: isRequestBodyObject(operation.requestBody) ? operation.requestBody : undefined, // Store original body info
                securityRequirements: operation.security !== undefined ? operation.security : globalSecurity, // Operation security overrides global
                securitySchemes, // Include security schemes from OpenAPI components
            };

            mappedTools.push({ mcpToolDefinition: mcpDefinition, apiCallDetails: apiDetails });
            console.error(`Mapped tool: ${toolName} (${method.toUpperCase()} ${path})`);
        }
    }

    console.error(`Total tools mapped: ${mappedTools.length}`);
    return mappedTools;
}

// Helper functions for type checking
function isReferenceObject(obj: any): obj is OpenAPIV3.ReferenceObject {
    return obj && typeof obj === 'object' && '$ref' in obj;
}

function isSchemaObject(obj: any): obj is OpenAPIV3.SchemaObject {
    return obj && typeof obj === 'object' && !Array.isArray(obj) && !isReferenceObject(obj);
}

function isRequestBodyObject(obj: any): obj is OpenAPIV3.RequestBodyObject {
    return obj && typeof obj === 'object' && !isReferenceObject(obj);
}

function isResponseObject(obj: any): obj is OpenAPIV3.ResponseObject {
    return obj && typeof obj === 'object' && !isReferenceObject(obj);
}

function isParameterObject(obj: any): obj is OpenAPIV3.ParameterObject {
    return obj && typeof obj === 'object' && !isReferenceObject(obj);
}

// Function to safely convert undefined to a valid JSONSchema7Definition
function safeJsonSchema(schema: JSONSchema7 | undefined): JSONSchema7Definition {
    return schema || {};
}
