/**
 * HTTP Server helper for testing
 * Sets up a simple HTTP server that serves static files for testing HTTP fetching
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { URL } from 'url'

export interface ServerConfig {
  port: number
  host: string
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 8888,
  host: 'localhost',
}

export class TestHttpServer {
  private server: http.Server | null = null
  private config: ServerConfig
  private fixturesPath: string
  private activePort: number | null = null

  /**
   * Create a new test HTTP server
   * @param fixturesPath Path to the fixtures directory to serve
   * @param config Server configuration
   */
  constructor(fixturesPath: string, config?: Partial<ServerConfig>) {
    this.fixturesPath = path.resolve(process.cwd(), fixturesPath)
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        return resolve()
      }

      this.server = http.createServer((req, res) => {
        if (!req.url) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        console.log(`Test server received request: ${req.method} ${req.url}`)

        try {
          const parsedUrl = new URL(req.url, `http://${this.config.host}:${this.config.port}`)
          // Remove leading slash and decode URI components
          const pathName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''))
          const filePath = path.join(this.fixturesPath, pathName)

          console.log(`Looking for file: ${filePath}`)

          // Check if the file exists
          if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`)
            res.statusCode = 404
            res.end(`Not found: ${pathName}`)
            return
          }

          // Set the appropriate content type
          if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json')
          } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
            res.setHeader('Content-Type', 'text/yaml')
          } else {
            res.setHeader('Content-Type', 'text/plain')
          }

          // Read the file synchronously to avoid issues with streaming
          const fileContent = fs.readFileSync(filePath, 'utf-8')
          res.statusCode = 200
          res.end(fileContent)
        } catch (error) {
          console.error('Error handling request:', error)
          res.statusCode = 500
          res.end('Internal server error')
        }
      })

      this.server.listen(this.config.port, this.config.host, () => {
        const address = this.server?.address()
        if (address && typeof address === 'object') {
          this.activePort = address.port
        } else {
          this.activePort = this.config.port
        }
        console.log(`Test HTTP server started at http://${this.config.host}:${this.activePort}`)
        resolve()
      })

      this.server.on('error', (err) => {
        console.error('Error starting test HTTP server:', err)
        reject(err)
      })
    })
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return resolve()
      }

      this.server.close((err) => {
        if (err) {
          console.error('Error closing test HTTP server:', err)
          reject(err)
          return
        }

        this.server = null
        this.activePort = null
        console.log('Test HTTP server stopped')
        resolve()
      })
    })
  }

  /**
   * Get the base URL for the server
   */
  getBaseUrl(): string {
    const port = this.activePort ?? this.config.port
    return `http://${this.config.host}:${port}`
  }

  /**
   * Get a URL for a specific file in the fixtures directory
   * @param filePath The path to the file, relative to fixtures directory
   */
  getFileUrl(filePath: string): string {
    return `${this.getBaseUrl()}/${filePath}`
  }
}
