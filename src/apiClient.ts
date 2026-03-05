import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import type { ApiCallDetails, ApiClientResponse } from './types';
import { config } from './config';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Applies security requirements to an API request based on OpenAPI security definitions
 * @param requestConfig Axios request configuration to modify
 * @param securityRequirements Security requirements from OpenAPI operation
 * @param securitySchemes Security schemes definitions from OpenAPI components
 */
async function applySecurity(
    requestConfig: AxiosRequestConfig,
    securityRequirements: OpenAPIV3.SecurityRequirementObject[] | null,
    securitySchemes: Record<string, OpenAPIV3.SecuritySchemeObject> | undefined
): Promise<boolean> {
    if (!securityRequirements || securityRequirements.length === 0) {
        return true;
    }

    if (!securitySchemes) {
        console.error("Security requirements defined but no security schemes available");
        return false;
    }

    // Loop through the security requirements to find one we can satisfy
    for (const requirement of securityRequirements) {
        // Each requirement is an AND of multiple schemes (all must be satisfied)
        const schemeNames = Object.keys(requirement);
        let allSchemesSatisfied = true;
        
        for (const schemeName of schemeNames) {
            console.error(`Attempting to apply security scheme: ${schemeName}`);
            
            // Get the security scheme definition
            const scheme = securitySchemes[schemeName];
            if (!scheme) {
                console.error(`Security scheme '${schemeName}' not found in OpenAPI definitions`);
                allSchemesSatisfied = false;
                break;
            }
            
            if (!requestConfig.headers) {
                requestConfig.headers = {};
            }
            
            // Apply security based on the scheme type
            switch (scheme.type) {
                case 'apiKey':
                    // Handle API Key (in header, query, or cookie)
                    const apiKey = config.securityCredentials?.[schemeName] || config.apiKey;
                    if (!apiKey) {
                        console.error(`No API key found for scheme '${schemeName}'`);
                        allSchemesSatisfied = false;
                        break;
                    }
                    
                    if (scheme.in === 'header') {
                        requestConfig.headers[scheme.name] = apiKey;
                        console.error(`Applied API Key header '${scheme.name}' for scheme: ${schemeName}`);
                    } else if (scheme.in === 'query') {
                        requestConfig.params = { ...requestConfig.params || {}, [scheme.name]: apiKey };
                        console.error(`Applied API Key query param '${scheme.name}' for scheme: ${schemeName}`);
                    } else if (scheme.in === 'cookie') {
                        // Simple cookie handling - in production, consider using a cookie jar
                        const cookieValue = `${scheme.name}=${apiKey}`;
                        requestConfig.headers['Cookie'] = requestConfig.headers['Cookie'] 
                            ? `${requestConfig.headers['Cookie']}; ${cookieValue}`
                            : cookieValue;
                        console.error(`Applied API Key cookie '${scheme.name}' for scheme: ${schemeName}`);
                    }
                    break;
                    
                case 'http':
                    // Handle HTTP authentication (Basic, Bearer)
                    const authCred = config.securityCredentials?.[schemeName] || config.apiKey;
                    if (!authCred) {
                        console.error(`No credentials found for scheme '${schemeName}'`);
                        allSchemesSatisfied = false;
                        break;
                    }
                    
                    if (scheme.scheme?.toLowerCase() === 'basic') {
                        // For Basic auth, credential should be username:password or we use a default
                        // In production, would need proper username/password configuration
                        const credentials = authCred.includes(':') 
                            ? Buffer.from(authCred).toString('base64')
                            : Buffer.from(`${authCred}:password`).toString('base64');
                        requestConfig.headers['Authorization'] = `Basic ${credentials}`;
                        console.error(`Applied Basic auth for scheme: ${schemeName}`);
                    } else if (scheme.scheme?.toLowerCase() === 'bearer') {
                        requestConfig.headers['Authorization'] = `Bearer ${authCred}`;
                        console.error(`Applied Bearer token for scheme: ${schemeName}`);
                    } else {
                        // Unknown HTTP auth type
                        console.error(`Unsupported HTTP auth scheme: ${scheme.scheme}`);
                        allSchemesSatisfied = false;
                    }
                    break;
                    
                case 'oauth2':
                    // For OAuth2, we'd typically have a token already acquired
                    const oauthToken = config.securityCredentials?.[schemeName] || config.apiKey;
                    if (!oauthToken) {
                        console.error(`No OAuth token found for scheme '${schemeName}'`);
                        allSchemesSatisfied = false;
                        break;
                    }
                    
                    requestConfig.headers['Authorization'] = `Bearer ${oauthToken}`;
                    console.error(`Applied OAuth2 token for scheme: ${schemeName}`);
                    break;
                    
                case 'openIdConnect':
                    // Similar to OAuth2
                    const oidcToken = config.securityCredentials?.[schemeName] || config.apiKey;
                    if (!oidcToken) {
                        console.error(`No OpenID Connect token found for scheme '${schemeName}'`);
                        allSchemesSatisfied = false;
                        break;
                    }
                    
                    requestConfig.headers['Authorization'] = `Bearer ${oidcToken}`;
                    console.error(`Applied OpenID Connect token for scheme: ${schemeName}`);
                    break;
                    
                default:
                    console.error(`Unsupported security scheme type: ${(scheme as any).type}`);
                    allSchemesSatisfied = false;
            }
            
            if (!allSchemesSatisfied) {
                break;
            }
        }
        
        if (allSchemesSatisfied) {
            // We found and applied a security requirement that we could satisfy
            return true;
        }
    }

    // If we get here, we tried all requirements but couldn't satisfy any
    console.error(`Could not satisfy any security requirements. API call may fail.`);
    return false;
}

export async function executeApiCall(
    details: ApiCallDetails,
    mcpInput: Record<string, any> // The raw input object from MCP
): Promise<ApiClientResponse> {
    const {
        method,
        pathTemplate,
        serverUrl,
        requestTimeoutMs,
        customHeaders,
        disableXMcp,
        parameters,
        requestBody,
        securityRequirements,
        securitySchemes
    } = details;

    // Input validation
    if (!method) {
        return { success: false, statusCode: 400, error: 'API call details missing HTTP method' };
    }
    
    if (!pathTemplate) {
        return { success: false, statusCode: 400, error: 'API call details missing path template' };
    }
    
    if (!serverUrl) {
        return { success: false, statusCode: 400, error: 'API call details missing server URL' };
    }
    
    // Ensure mcpInput is a valid object
    if (!mcpInput || typeof mcpInput !== 'object' || Array.isArray(mcpInput)) {
        console.error(`Invalid input type: ${typeof mcpInput}. Expected an object.`);
        return { success: false, statusCode: 400, error: 'Invalid input: expected an object' };
    }

    // Normalize the input object to handle different formats
    // Some MCP clients might send parameters differently
    const normalizedInput = { ...mcpInput };

    let url = `${serverUrl}${pathTemplate}`;
    const queryParams: Record<string, any> = {};
    const headers: Record<string, any> = {};
    let body: any = undefined;

    console.error(`Executing API call for tool: ${details.method} ${details.pathTemplate}`);
    console.error(`MCP input keys: ${Object.keys(normalizedInput).join(', ') || '(none)'}`);


    // Map MCP input back to HTTP request components
    for (const paramDef of parameters) {
        const paramName = paramDef.name;
        const paramValue = normalizedInput[paramName];

        if (paramValue !== undefined) { // Only map if present in MCP input
            // Validate parameter value according to schema if possible
            if (paramDef.schema) {
                const validationError = validateParameterValue(paramValue, paramDef);
                if (validationError) {
                    return { success: false, statusCode: 400, error: `Parameter '${paramName}': ${validationError}` };
                }
            }
            
            switch (paramDef.in) {
                case 'path':
                    url = url.replace(`{${paramName}}`, encodeURIComponent(String(paramValue)));
                    break;
                case 'query':
                    queryParams[paramName] = paramValue;
                    break;
                case 'header':
                    // Prevent header injection via CRLF in user-provided header values.
                    {
                        const headerValue = String(paramValue);
                        if (/[\r\n]/.test(headerValue)) {
                            return { success: false, statusCode: 400, error: `Invalid header value for parameter: ${paramName}` };
                        }
                        headers[paramName] = headerValue;
                    }
                    break;
                case 'cookie':
                    // Cookie handling is more complex, often managed by agents or specific header logic
                    console.error(`Cookie parameter '${paramName}' handling not implemented.`);
                    break;
            }
        } else if (paramDef.required) {
             console.error(`Error: Required parameter '${paramName}' missing in MCP input.`);
             return { success: false, statusCode: 400, error: `Missing required parameter: ${paramName}` };
        }
    }

     // Map request body if defined and present in input
     if (requestBody && normalizedInput.requestBody !== undefined) {
         // Validate request body against schema if available
         const bodyValidationError = validateRequestBody(normalizedInput.requestBody, requestBody);
         if (bodyValidationError) {
             return { success: false, statusCode: 400, error: `Request body validation failed: ${bodyValidationError}` };
         }
         
         // Assuming the nested 'requestBody' property in mcpInput holds the body
         body = normalizedInput.requestBody;
         // Assume application/json for now, get content type from requestBody definition if needed
         headers['Content-Type'] = 'application/json';
     } else if (requestBody?.required) {
          console.error(`Error: Required requestBody missing in MCP input.`);
          return { success: false, statusCode: 400, error: `Missing required request body` };
     }


    const requestConfig: AxiosRequestConfig = {
        method: method as any, // Cast needed for Axios types
        url: url,
        params: queryParams,
        headers: headers,
        data: body,
        timeout: requestTimeoutMs ?? config.requestTimeoutMs,
        // Validate status to handle non-2xx as resolved promises
        validateStatus: (status: number) => status >= 200 && status < 500, // Handle 4xx as well
    };

    // Apply custom headers from configuration
    const effectiveHeaders = customHeaders ?? config.customHeaders;
    if (effectiveHeaders && Object.keys(effectiveHeaders).length > 0) {
        requestConfig.headers = { ...requestConfig.headers, ...effectiveHeaders };
    }

    // Add X-MCP header unless disabled
    const shouldDisableXMcp = disableXMcp ?? config.disableXMcp;
    if (!shouldDisableXMcp) {
        requestConfig.headers = { ...requestConfig.headers, 'X-MCP': '1' };
    }
    
    // Apply security before making the call
    try {
        const securityApplied = await applySecurity(requestConfig, securityRequirements, securitySchemes);
        if (!securityApplied && securityRequirements && securityRequirements.length > 0) {
            return { success: false, statusCode: 401, error: 'Required API security credentials are missing or invalid' };
        }
    } catch (secErr: any) {
        console.error("Security application failed:", secErr);
        return { success: false, statusCode: 401, error: `Security setup failed: ${secErr.message}` };
    }

    const sanitizedHeaders = Object.fromEntries(
        Object.entries(requestConfig.headers || {}).map(([key, value]) => {
            const lower = key.toLowerCase();
            if (lower === 'authorization' || lower === 'cookie' || lower.includes('api-key') || lower.includes('token')) {
                return [key, '[REDACTED]'];
            }
            return [key, value];
        })
    );

    console.error(`Making HTTP request:`, {
        method: requestConfig.method,
        url: requestConfig.url,
        params: requestConfig.params,
        headers: sanitizedHeaders,
        data: requestConfig.data ? '[Request Body Present]' : undefined // Avoid logging sensitive data
    });

    try {
        const response = await axios(requestConfig);

        console.error(`API response received: Status ${response.status}`);

        if (response.status >= 200 && response.status < 300) {
            return {
                success: true,
                statusCode: response.status,
                data: response.data,
            };
        } else {
            // Handle 4xx client errors reported by the API
            console.error(`API returned client error ${response.status}`);
            return {
                success: false,
                statusCode: response.status,
                error: `API Error ${response.status}: ${JSON.stringify(response.data)}`,
                data: response.data // Optionally include error data
            };
        }
    } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`API call failed: ${axiosError.message}`, axiosError.code || 'UNKNOWN');

        if (axiosError.code === 'ECONNABORTED') {
            const timeoutMs = requestTimeoutMs ?? config.requestTimeoutMs;
            return {
                success: false,
                statusCode: 504,
                error: `Target API timeout after ${timeoutMs}ms`,
            };
        } else if (axiosError.response) {
            // Errors during the request setup or >= 500 if validateStatus wasn't broad enough
            return {
                success: false,
                statusCode: axiosError.response.status || 500,
                error: `API Error ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data) || axiosError.message}`,
                data: axiosError.response.data
            };
        } else {
            // Network error, DNS error, etc.
            return {
                success: false,
                statusCode: 503, // Service Unavailable or similar
                error: `Network or request setup error: ${axiosError.message}`,
            };
        }
    }
}

/**
 * Validates a parameter value against its schema definition
 * @param value The parameter value to validate
 * @param paramDef The parameter definition from OpenAPI
 * @returns Error message or null if valid
 */
function validateParameterValue(value: any, paramDef: OpenAPIV3.ParameterObject): string | null {
    const schema = paramDef.schema as OpenAPIV3.SchemaObject;
    if (!schema) return null; // No schema to validate against
    
    // Type validation
    if (schema.type === 'integer' || schema.type === 'number') {
        if (typeof value !== 'number') {
            return `expected ${schema.type}, got ${typeof value}`;
        }
        
        if (schema.type === 'integer' && !Number.isInteger(value)) {
            return 'must be an integer';
        }
        
        // Range check
        if (schema.minimum !== undefined && value < schema.minimum) {
            return `must be >= ${schema.minimum}`;
        }
        
        if (schema.maximum !== undefined && value > schema.maximum) {
            return `must be <= ${schema.maximum}`;
        }
    } 
    else if (schema.type === 'string') {
        if (typeof value !== 'string') {
            return `expected string, got ${typeof value}`;
        }
        
        // Length check
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            return `length must be >= ${schema.minLength}`;
        }
        
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            return `length must be <= ${schema.maxLength}`;
        }
        
        // Pattern check
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
            return `must match pattern ${schema.pattern}`;
        }
        
        // Format check
        if (schema.format === 'date-time') {
            const dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) {
                return 'must be a valid date-time string';
            }
        } else if (schema.format === 'email') {
            // Simple email validation
            if (!value.includes('@')) {
                return 'must be a valid email address';
            }
        }
    } 
    else if (schema.type === 'boolean') {
        if (typeof value !== 'boolean') {
            return `expected boolean, got ${typeof value}`;
        }
    } 
    else if (schema.type === 'array') {
        if (!Array.isArray(value)) {
            return `expected array, got ${typeof value}`;
        }
        
        // Check array length
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            return `array length must be >= ${schema.minItems}`;
        }
        
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            return `array length must be <= ${schema.maxItems}`;
        }
    }
    
    // Enum check for any type
    if (schema.enum && !schema.enum.includes(value)) {
        return `must be one of: ${schema.enum.join(', ')}`;
    }
    
    return null; // No validation errors
}

/**
 * Validates a request body against its schema definition
 * @param body The request body to validate
 * @param requestBodyDef The request body definition from OpenAPI
 * @returns Error message or null if valid
 */
function validateRequestBody(body: any, requestBodyDef: OpenAPIV3.RequestBodyObject): string | null {
    if (!requestBodyDef.content || !requestBodyDef.content['application/json']) {
        // No JSON schema to validate against
        return null;
    }
    
    const schema = requestBodyDef.content['application/json'].schema as OpenAPIV3.SchemaObject;
    if (!schema) return null;
    
    // Basic type check
    if (schema.type === 'object') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return 'Request body must be an object';
        }
        
        // Check required properties
        if (schema.required && Array.isArray(schema.required)) {
            for (const requiredProp of schema.required) {
                if (body[requiredProp] === undefined) {
                    return `Missing required property: ${requiredProp}`;
                }
            }
        }
        
        // Property type validation could be added here
        // This would involve recursively checking properties against schema.properties
    } 
    else if (schema.type === 'array') {
        if (!Array.isArray(body)) {
            return 'Request body must be an array';
        }
        
        // Array validation logic would go here
    }
    
    return null; // No validation errors
}
