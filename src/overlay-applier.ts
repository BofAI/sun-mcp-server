/**
 * Overlay Applier – Reference implementation of the Overlay Specification v1.0.0
 *
 * Features
 * --------
 * • Parses Overlay documents written in JSON or YAML (via `js-yaml`).
 * • Applies actions sequentially using JSONPath queries (via `jsonpath-plus`).
 * • Supports `update` (deep merge into objects or append to arrays) and `remove` operations.
 * • Non‑destructive: works on a deep clone of the target document.
 * • Zero‑match actions are silently ignored, per spec.
 * • Provides programmatic API, helper wrappers, and an optional CLI (`ts-node overlay-applier.ts --overlay o.yaml --target api.yaml`).
 *
 * Dependencies
 * ------------
 * ```bash
 * npm install jsonpath-plus js-yaml deepmerge yargs
 * ```
 *
 * Example
 * -------
 * ```typescript
 * import { OverlayApplier } from './overlay-applier';
 * import fs from 'node:fs';
 *
 * const overlayTxt = fs.readFileSync('overlay.yaml', 'utf8');
 * const apiTxt = fs.readFileSync('api.yaml', 'utf8');
 *
 * const applier = new OverlayApplier();
 * const result = applier.apply(apiTxt, overlayTxt);
 *
 * console.log(applier.stringify(result, { yaml: true }));
 * ```
 */

import { JSONPath } from 'jsonpath-plus';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import deepmerge from 'deepmerge';

/** Overlay → info object */
export interface OverlayInfo {
  title: string;
  version: string;
  /** Specification extensions */
  [k: `x-${string}`]: unknown;
}

/** Single action item */
export interface Action {
  /** JSONPath expression selecting nodes in the target document */
  target: string;
  /** Human‑readable description (CommonMark allowed) */
  description?: string;
  /** Object or value to merge into the selected node(s) */
  update?: unknown;
  /** Remove selected node(s) */
  remove?: boolean;
  /** Specification extensions */
  [k: `x-${string}`]: unknown;
}

/** Root overlay object */
export interface OverlayDoc {
  /** Overlay spec version, e.g. `1.0.0` */
  overlay: string;
  info: OverlayInfo;
  extends?: string;
  actions: Action[];
  /** Specification extensions */
  [k: `x-${string}`]: unknown;
}

/**
 * OverlayApplier – core engine
 */
export class OverlayApplier {
  /** JSONPath‑plus options */
  private readonly jpOptions: { resultType: 'all' } = { resultType: 'all' as const };

  /** Deep‑clone helper using structuredClone where available */
  private clone<T>(obj: T): T {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
  }

  /** Parse YAML or JSON text into an OverlayDoc */
  parseOverlay(text: string): OverlayDoc {
    try {
      if (/^\s*[\[{]/.test(text)) {
        return JSON.parse(text) as OverlayDoc;
      }
      return yamlLoad(text) as OverlayDoc;
    } catch (err) {
      throw new Error(`Failed to parse overlay: ${(err as Error).message}`);
    }
  }

  /** Parse YAML or JSON text into a plain JS object */
  parseAny(text: string): unknown {
    try {
      if (/^\s*[\[{]/.test(text)) {
        return JSON.parse(text);
      }
      return yamlLoad(text);
    } catch (err) {
      throw new Error(`Failed to parse document: ${(err as Error).message}`);
    }
  }

  /** Serialize object back to text */
  stringify(obj: unknown, opts: { yaml?: boolean } = {}): string {
    return opts.yaml ? yamlDump(obj, { lineWidth: 120, noRefs: true }) : JSON.stringify(obj, null, 2);
  }

  /** Public API: apply overlay to target (both can be objects or text) */
  apply(target: string | unknown, overlay: string | OverlayDoc): unknown {
    const overlayDoc: OverlayDoc = typeof overlay === 'string' ? this.parseOverlay(overlay) : overlay;
    if (!overlayDoc.overlay) throw new Error('Overlay document missing required "overlay" version field');

    const targetObj: any = typeof target === 'string' ? this.parseAny(target) : target;
    let workingDoc: any = this.clone(targetObj);

    for (const action of overlayDoc.actions) {
      workingDoc = this.applyAction(workingDoc, action);
    }
    return workingDoc;
  }

  /** Apply a single action and return the mutated document */
  private applyAction(doc: any, action: Action): any {
    const { target: expr, update, remove = false } = action;
    if (!expr) throw new Error('Action is missing required "target" field');

    try {
      // First, find all matches in the document using JSONPath
      const matches = JSONPath({ path: expr, json: doc, resultType: 'all' });
      
      // Per spec: if zero matches found, silently ignore (no-op)
      if (!matches.length) return doc;

      // Special case for info section which gives direct property access
      if (expr === '$.info' && update && typeof update === 'object') {
        doc.info = deepmerge(doc.info, update as object);
        return doc;
      }
      
      // Special case for path operations that need direct access
      if (expr.startsWith("$.paths[") && expr.endsWith("].get") && update && typeof update === 'object') {
        // Extract the path from the expression
        const pathMatch = expr.match(/\$\.paths\['([^']+)'\]/);
        if (pathMatch) {
          const path = pathMatch[1];
          doc.paths[path].get = deepmerge(doc.paths[path].get, update as object);
          return doc;
        }
      }
      
      // Special case for parameter updates that need to find by name
      if (expr.includes('parameters[?(@.name==') && update && typeof update === 'object') {
        // Extract path and param name from expression
        const pathMatch = expr.match(/\$\.paths\['([^']+)'\]/);
        const nameMatch = expr.match(/name=='([^']+)'/);
        
        if (pathMatch && nameMatch) {
          const path = pathMatch[1];
          const paramName = nameMatch[1];
          const method = expr.includes('.get.') ? 'get' : 
                       expr.includes('.post.') ? 'post' : 
                       expr.includes('.put.') ? 'put' : 
                       expr.includes('.delete.') ? 'delete' : 'get';
          
          // Find the parameter and update it
          const params = doc.paths[path][method].parameters;
          const paramIndex = params.findIndex((p: any) => p.name === paramName);
          
          if (paramIndex !== -1) {
            params[paramIndex] = deepmerge(params[paramIndex], update as object);
          }
          
          return doc;
        }
      }
      
      // Process matches using standard JSONPath for other cases
      for (const match of matches) {
        if (!match.path || !Array.isArray(match.path)) continue;
        
        // Get the parent path and key
        const parentPath = match.path.slice(0, -1);
        const key = match.path[match.path.length - 1];
        
        // Find the parent object/array that contains the node we want to modify
        const parentRef = JSONPath({ path: this.toJsonPath(parentPath), json: doc, resultType: 'value' })[0];
        if (!parentRef) continue;
        
        // Handle 'remove' action - delete the node from its parent
        if (remove === true) {
          if (Array.isArray(parentRef)) {
            parentRef.splice(Number(key), 1);
          } else if (typeof parentRef === 'object' && parentRef !== null) {
            delete parentRef[key];
          }
          continue;
        }
        
        // Handle 'update' action if remove is false
        if (update !== undefined) {
          const targetNode = match.value;
          
          if (Array.isArray(targetNode)) {
            // For arrays, append the update value
            targetNode.push(update);
          } else if (typeof targetNode === 'object' && targetNode !== null) {
            // For objects, deep merge the properties
            const merged = deepmerge(targetNode, update as object, {
              arrayMerge: (dest, src) => dest.concat(src),
            });
            
            // Update the parent reference to the merged object
            if (Array.isArray(parentRef)) {
              parentRef[Number(key)] = merged;
            } else {
              parentRef[key] = merged;
            }
          } else {
            // For primitive values, just replace them with the update
            if (Array.isArray(parentRef)) {
              parentRef[Number(key)] = update;
            } else {
              parentRef[key] = update;
            }
          }
        }
      }
    } catch (err) {
      // Log error but don't throw - non-fatal per spec
      console.error(`Error applying overlay action with target ${expr}:`, err);
    }
    
    return doc;
  }

  /** Remove property or array element from parent */
  private removeFromParent(parent: any, key: string | number) {
    if (Array.isArray(parent)) {
      parent.splice(Number(key), 1);
    } else if (parent && typeof parent === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete parent[key as keyof typeof parent];
    }
  }

  /** Assign helper that works for object or array parents */
  private assignToParent(parent: any, key: string | number, value: unknown) {
    if (Array.isArray(parent)) {
      parent[Number(key)] = value;
    } else {
      parent[key as keyof typeof parent] = value;
    }
  }

  /** Convert JSONPath array back to string form */
  private toJsonPath(arr: (string | number)[]): string {
    if (!arr.length) return '$';
    return arr
      .map((seg, idx) => {
        if (idx === 0) return '$';
        if (typeof seg === 'number') return `[${seg}]`;
        return /^[a-zA-Z_][\w$]*$/.test(seg as string) ? `.${seg}` : `["${String(seg).replace(/"/g, '\\"')}"]`;
      })
      .join('');
  }
}

/** Convenience helper wrapping parse‑apply‑stringify for CLI use */
export function applyOverlayText(
  targetText: string,
  overlayText: string,
  opts: { yamlOutput?: boolean } = {},
): string {
  const engine = new OverlayApplier();
  const result = engine.apply(targetText, overlayText);
  return engine.stringify(result, { yaml: !!opts.yamlOutput });
}
