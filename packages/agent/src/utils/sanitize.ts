/**
 * Input Sanitization Utilities
 *
 * Provides comprehensive input sanitization to prevent:
 * - XSS (Cross-Site Scripting) attacks
 * - SQL injection attempts
 * - Command injection
 * - Path traversal attacks
 * - Other injection vulnerabilities
 */

/**
 * Options for string sanitization
 */
export interface SanitizeOptions {
  /** Maximum allowed length for the string */
  maxLength?: number;
  /** Allow HTML tags (default: false) */
  allowHtml?: boolean;
  /** Allow newlines (default: true) */
  allowNewlines?: boolean;
  /** Custom patterns to remove (regex patterns) */
  removePatterns?: RegExp[];
}

/**
 * Sanitize a string to prevent XSS and injection attacks
 *
 * @param input - The string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeString(input: string, options: SanitizeOptions = {}): string {
  const { maxLength, allowHtml = false, allowNewlines = true, removePatterns = [] } = options;

  let sanitized = input;

  // Remove HTML tags unless explicitly allowed
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
      .replace(/<embed\b[^<]*>/gi, '') // Remove embed tags
      .replace(/<link\b[^<]*>/gi, '') // Remove link tags
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
      .replace(/<[^>]+>/g, ''); // Remove all other HTML tags
  }

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Remove newlines if not allowed
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  }

  // Apply custom removal patterns
  for (const pattern of removePatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Trim and normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');

  // Enforce maximum length
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize tool parameters based on schema
 *
 * @param params - Raw parameters object
 * @param schema - Parameter schema with type and validation rules
 * @returns Sanitized parameters
 * @throws Error if validation fails
 */
export function sanitizeToolParameters(
  params: Record<string, any>,
  schema: Record<string, any>,
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    const fieldSchema = schema[key];

    // Skip unknown fields (not in schema)
    if (!fieldSchema) {
      continue;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      if (fieldSchema.required) {
        throw new Error(`Required parameter '${key}' is missing`);
      }
      continue;
    }

    // Type validation and sanitization
    const expectedType = fieldSchema.type;
    const actualType = typeof value;

    if (expectedType === 'string') {
      if (actualType !== 'string') {
        throw new Error(`Parameter '${key}' must be a string, got ${actualType}`);
      }

      // Sanitize string
      sanitized[key] = sanitizeString(value, {
        maxLength: fieldSchema.maxLength,
        allowHtml: fieldSchema.allowHtml,
        allowNewlines: fieldSchema.allowNewlines !== false,
      });

      // Check minimum length
      if (fieldSchema.minLength && sanitized[key].length < fieldSchema.minLength) {
        throw new Error(`Parameter '${key}' must be at least ${fieldSchema.minLength} characters`);
      }

      // Check pattern
      if (fieldSchema.pattern && !fieldSchema.pattern.test(sanitized[key])) {
        throw new Error(`Parameter '${key}' does not match required pattern`);
      }
    } else if (expectedType === 'number') {
      if (actualType !== 'number' || Number.isNaN(value)) {
        throw new Error(`Parameter '${key}' must be a number, got ${actualType}`);
      }

      // Validate range
      if (fieldSchema.min !== undefined && value < fieldSchema.min) {
        throw new Error(`Parameter '${key}' must be at least ${fieldSchema.min}`);
      }
      if (fieldSchema.max !== undefined && value > fieldSchema.max) {
        throw new Error(`Parameter '${key}' must be at most ${fieldSchema.max}`);
      }

      sanitized[key] = value;
    } else if (expectedType === 'boolean') {
      if (actualType !== 'boolean') {
        throw new Error(`Parameter '${key}' must be a boolean, got ${actualType}`);
      }
      sanitized[key] = value;
    } else if (expectedType === 'array') {
      if (!Array.isArray(value)) {
        throw new Error(`Parameter '${key}' must be an array, got ${actualType}`);
      }

      // Validate array length
      if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
        throw new Error(`Parameter '${key}' must have at least ${fieldSchema.minItems} items`);
      }
      if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
        throw new Error(`Parameter '${key}' must have at most ${fieldSchema.maxItems} items`);
      }

      // Sanitize array items if they are strings
      if (fieldSchema.items?.type === 'string') {
        sanitized[key] = value.map((item) =>
          typeof item === 'string'
            ? sanitizeString(item, {
                maxLength: fieldSchema.items.maxLength,
                allowHtml: fieldSchema.items.allowHtml,
              })
            : item,
        );
      } else {
        sanitized[key] = value;
      }
    } else if (expectedType === 'object') {
      if (actualType !== 'object' || Array.isArray(value)) {
        throw new Error(`Parameter '${key}' must be an object, got ${actualType}`);
      }

      // Recursively sanitize nested objects if schema is provided
      if (fieldSchema.properties) {
        sanitized[key] = sanitizeToolParameters(value, fieldSchema.properties);
      } else {
        sanitized[key] = value;
      }
    } else {
      // Unknown type, pass through
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize a file path to prevent path traversal attacks
 *
 * @param path - The file path to sanitize
 * @param allowAbsolute - Whether to allow absolute paths (default: false)
 * @returns Sanitized path
 * @throws Error if path is invalid or contains dangerous patterns
 */
export function sanitizePath(path: string, allowAbsolute = false): string {
  // Remove null bytes
  let sanitized = path.replace(/\0/g, '');

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Check for path traversal attempts
  if (sanitized.includes('../') || sanitized.includes('/..')) {
    throw new Error('Path traversal detected: ".." is not allowed');
  }

  // Check for absolute paths if not allowed
  if (!allowAbsolute && (sanitized.startsWith('/') || /^[a-zA-Z]:/.test(sanitized))) {
    throw new Error('Absolute paths are not allowed');
  }

  // Remove multiple consecutive slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  // Remove leading/trailing slashes for relative paths
  if (!allowAbsolute) {
    sanitized = sanitized.replace(/^\/+|\/+$/g, '');
  }

  // Check for empty path
  if (!sanitized) {
    throw new Error('Path cannot be empty');
  }

  return sanitized;
}

/**
 * Sanitize SQL identifiers (table names, column names)
 * Note: This is a basic sanitizer. Always use parameterized queries for values.
 *
 * @param identifier - The SQL identifier to sanitize
 * @returns Sanitized identifier
 * @throws Error if identifier contains invalid characters
 */
export function sanitizeSQLIdentifier(identifier: string): string {
  // SQL identifiers should only contain alphanumeric characters and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(
      `Invalid SQL identifier: ${identifier}. Only alphanumeric characters and underscores are allowed.`,
    );
  }

  // Check length (most databases have limits)
  if (identifier.length > 64) {
    throw new Error('SQL identifier too long: maximum 64 characters');
  }

  // Check for SQL keywords (basic list)
  const sqlKeywords = new Set([
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TABLE',
    'FROM',
    'WHERE',
    'JOIN',
    'UNION',
    'ORDER',
    'GROUP',
    'HAVING',
  ]);

  if (sqlKeywords.has(identifier.toUpperCase())) {
    throw new Error(`SQL identifier cannot be a reserved keyword: ${identifier}`);
  }

  return identifier;
}

/**
 * Sanitize user input for display (prevent XSS in UI)
 *
 * @param input - The input to sanitize
 * @returns HTML-escaped string safe for display
 */
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize email addresses
 *
 * @param email - The email to validate
 * @returns Sanitized email
 * @throws Error if email is invalid
 */
export function sanitizeEmail(email: string): string {
  // Basic email regex (not RFC 5322 compliant, but good enough for most cases)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const sanitized = email.trim().toLowerCase();

  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email address format');
  }

  if (sanitized.length > 254) {
    throw new Error('Email address too long');
  }

  return sanitized;
}

/**
 * Validate and sanitize URLs
 *
 * @param url - The URL to validate
 * @param allowedProtocols - List of allowed protocols (default: ['http', 'https'])
 * @returns Sanitized URL
 * @throws Error if URL is invalid or uses disallowed protocol
 */
export function sanitizeURL(url: string, allowedProtocols: string[] = ['http', 'https']): string {
  try {
    const parsed = new URL(url);

    // Check protocol
    const protocol = parsed.protocol.replace(':', '').toLowerCase();
    if (!allowedProtocols.includes(protocol)) {
      throw new Error(
        `URL protocol '${protocol}' is not allowed. Allowed protocols: ${allowedProtocols.join(', ')}`,
      );
    }

    // Check for suspicious characters in hostname
    if (/[\s<>'"()]/.test(parsed.hostname)) {
      throw new Error('URL hostname contains invalid characters');
    }

    return parsed.toString();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    throw error;
  }
}

/**
 * Sanitize command arguments to prevent command injection
 *
 * @param args - Array of command arguments
 * @returns Sanitized arguments
 * @throws Error if dangerous patterns are detected
 */
export function sanitizeCommandArgs(args: string[]): string[] {
  const dangerousPatterns = [
    /[;&|`$()]/g, // Shell metacharacters
    /\$\{/g, // Variable expansion
    /\$\(/g, // Command substitution
    />\s*&/g, // Redirection
  ];

  return args.map((arg) => {
    let sanitized = arg;

    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        throw new Error(`Command argument contains dangerous pattern: ${arg}`);
      }
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    return sanitized;
  });
}

/**
 * Deep sanitize an object recursively
 *
 * @param obj - The object to sanitize
 * @param options - Sanitization options for string values
 * @returns Sanitized object
 */
export function deepSanitize(obj: any, options: SanitizeOptions = {}): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deepSanitize(value, options);
    }
    return sanitized;
  }

  // Primitive types (number, boolean, etc.) pass through
  return obj;
}
