import { describe, expect, it } from 'vitest';
import {
  deepSanitize,
  sanitizeCommandArgs,
  sanitizeEmail,
  sanitizeForDisplay,
  sanitizePath,
  sanitizeSQLIdentifier,
  sanitizeString,
  sanitizeToolParameters,
  sanitizeURL,
} from '../sanitize';

describe('sanitizeString', () => {
  it('should remove script tags', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    const result = sanitizeString(input);
    expect(result).toBe('Hello World'); // Whitespace is normalized
    expect(result).not.toContain('<script>');
  });

  it('should remove iframe tags', () => {
    const input = 'Content <iframe src="evil.com"></iframe> more';
    const result = sanitizeString(input);
    expect(result).not.toContain('<iframe');
  });

  it('should remove event handlers', () => {
    const input = '<div onclick="alert(1)">Click me</div>';
    const result = sanitizeString(input);
    expect(result).not.toContain('onclick');
  });

  it('should remove javascript: protocol', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeString(input);
    expect(result).not.toContain('javascript:');
  });

  it('should enforce max length', () => {
    const input = 'a'.repeat(100);
    const result = sanitizeString(input, { maxLength: 50 });
    expect(result).toHaveLength(50);
  });

  it('should allow HTML when specified', () => {
    const input = '<b>Bold</b> text';
    const result = sanitizeString(input, { allowHtml: true });
    expect(result).toContain('<b>');
  });

  it('should remove newlines when not allowed', () => {
    const input = 'Line 1\nLine 2\nLine 3';
    const result = sanitizeString(input, { allowNewlines: false });
    expect(result).not.toContain('\n');
    expect(result).toBe('Line 1 Line 2 Line 3');
  });

  it('should apply custom removal patterns', () => {
    const input = 'Hello @username! How are you?';
    const result = sanitizeString(input, {
      removePatterns: [/@\w+/g],
    });
    expect(result).not.toContain('@username');
  });

  it('should handle empty strings', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('should normalize whitespace', () => {
    const input = 'Hello    world   \n\n   test';
    const result = sanitizeString(input);
    expect(result).toBe('Hello world test');
  });
});

describe('sanitizeToolParameters', () => {
  it('should sanitize string parameters', () => {
    const params = {
      prompt: '<script>alert("xss")</script>Hello',
    };
    const schema = {
      prompt: { type: 'string', required: true },
    };

    const result = sanitizeToolParameters(params, schema);
    expect(result.prompt).not.toContain('<script>');
    expect(result.prompt).toContain('Hello');
  });

  it('should skip missing optional parameters', () => {
    const params = {};
    const schema = {
      name: { type: 'string', required: false },
    };

    const result = sanitizeToolParameters(params, schema);
    expect(result).toEqual({});
  });

  it('should validate string type', () => {
    const params = {
      name: 123,
    };
    const schema = {
      name: { type: 'string' },
    };

    expect(() => sanitizeToolParameters(params, schema)).toThrow(
      "Parameter 'name' must be a string",
    );
  });

  it('should validate number type and range', () => {
    const params = {
      age: 150,
    };
    const schema = {
      age: { type: 'number', min: 0, max: 120 },
    };

    expect(() => sanitizeToolParameters(params, schema)).toThrow(
      "Parameter 'age' must be at most 120",
    );
  });

  it('should validate boolean type', () => {
    const params = {
      active: 'yes',
    };
    const schema = {
      active: { type: 'boolean' },
    };

    expect(() => sanitizeToolParameters(params, schema)).toThrow(
      "Parameter 'active' must be a boolean",
    );
  });

  it('should validate array type and length', () => {
    const params = {
      tags: ['a'],
    };
    const schema = {
      tags: { type: 'array', minItems: 2 },
    };

    expect(() => sanitizeToolParameters(params, schema)).toThrow(
      "Parameter 'tags' must have at least 2 items",
    );
  });

  it('should sanitize array items', () => {
    const params = {
      items: ['<script>bad</script>item1', 'item2'],
    };
    const schema = {
      items: {
        type: 'array',
        items: { type: 'string' },
      },
    };

    const result = sanitizeToolParameters(params, schema);
    expect(result.items[0]).not.toContain('<script>');
  });

  it('should validate nested objects', () => {
    const params = {
      user: {
        name: '<b>John</b>',
        age: 30,
      },
    };
    const schema = {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      },
    };

    const result = sanitizeToolParameters(params, schema);
    expect(result.user.name).not.toContain('<b>');
    expect(result.user.age).toBe(30);
  });

  it('should skip unknown fields', () => {
    const params = {
      known: 'value',
      unknown: 'should be skipped',
    };
    const schema = {
      known: { type: 'string' },
    };

    const result = sanitizeToolParameters(params, schema);
    expect(result.known).toBe('value');
    expect(result.unknown).toBeUndefined();
  });

  it('should validate string length', () => {
    const params = {
      code: 'ab',
    };
    const schema = {
      code: { type: 'string', minLength: 3 },
    };

    expect(() => sanitizeToolParameters(params, schema)).toThrow(
      "Parameter 'code' must be at least 3 characters",
    );
  });

  it('should validate string pattern', () => {
    const params = {
      email: 'invalid-email',
    };
    const schema = {
      email: { type: 'string', pattern: /^[\w.-]+@[\w.-]+\.\w+$/ },
    };

    expect(() => sanitizeToolParameters(params, schema)).toThrow(
      "Parameter 'email' does not match required pattern",
    );
  });
});

describe('sanitizePath', () => {
  it('should allow valid relative paths', () => {
    const path = 'folder/subfolder/file.txt';
    expect(sanitizePath(path)).toBe('folder/subfolder/file.txt');
  });

  it('should prevent path traversal with ../', () => {
    const path = 'folder/../../../etc/passwd';
    expect(() => sanitizePath(path)).toThrow('Path traversal detected');
  });

  it('should prevent absolute paths by default', () => {
    const path = '/etc/passwd';
    expect(() => sanitizePath(path)).toThrow('Absolute paths are not allowed');
  });

  it('should allow absolute paths when specified', () => {
    const path = '/home/user/file.txt';
    expect(sanitizePath(path, true)).toBe('/home/user/file.txt');
  });

  it('should normalize path separators', () => {
    const path = 'folder\\subfolder\\file.txt';
    expect(sanitizePath(path)).toBe('folder/subfolder/file.txt');
  });

  it('should remove null bytes', () => {
    const path = 'folder\0/file.txt';
    expect(sanitizePath(path)).toBe('folder/file.txt');
  });

  it('should remove multiple consecutive slashes', () => {
    const path = 'folder///subfolder//file.txt';
    expect(sanitizePath(path)).toBe('folder/subfolder/file.txt');
  });

  it('should throw on empty path', () => {
    expect(() => sanitizePath('')).toThrow('Path cannot be empty');
  });
});

describe('sanitizeSQLIdentifier', () => {
  it('should allow valid identifiers', () => {
    expect(sanitizeSQLIdentifier('users')).toBe('users');
    expect(sanitizeSQLIdentifier('user_id')).toBe('user_id');
    expect(sanitizeSQLIdentifier('_private')).toBe('_private');
  });

  it('should reject identifiers with special characters', () => {
    expect(() => sanitizeSQLIdentifier('user-name')).toThrow('Invalid SQL identifier');
    expect(() => sanitizeSQLIdentifier('user.name')).toThrow('Invalid SQL identifier');
    expect(() => sanitizeSQLIdentifier('user;DROP TABLE')).toThrow('Invalid SQL identifier');
  });

  it('should reject identifiers starting with numbers', () => {
    expect(() => sanitizeSQLIdentifier('123users')).toThrow('Invalid SQL identifier');
  });

  it('should reject SQL keywords', () => {
    expect(() => sanitizeSQLIdentifier('SELECT')).toThrow('reserved keyword');
    expect(() => sanitizeSQLIdentifier('DROP')).toThrow('reserved keyword');
  });

  it('should reject identifiers that are too long', () => {
    const longIdentifier = 'a'.repeat(65);
    expect(() => sanitizeSQLIdentifier(longIdentifier)).toThrow('too long');
  });
});

describe('sanitizeForDisplay', () => {
  it('should escape HTML entities', () => {
    const input = '<script>alert("xss")</script>';
    const result = sanitizeForDisplay(input);
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
  });

  it('should escape all dangerous characters', () => {
    const input = '&<>"\'/';
    const result = sanitizeForDisplay(input);
    expect(result).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;');
  });

  it('should handle safe text', () => {
    const input = 'Hello World';
    const result = sanitizeForDisplay(input);
    expect(result).toBe('Hello World');
  });
});

describe('sanitizeEmail', () => {
  it('should allow valid emails', () => {
    expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
    expect(sanitizeEmail('test.user+tag@example.co.uk')).toBe('test.user+tag@example.co.uk');
  });

  it('should normalize to lowercase', () => {
    expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('should reject invalid emails', () => {
    expect(() => sanitizeEmail('invalid')).toThrow('Invalid email address format');
    expect(() => sanitizeEmail('user@')).toThrow('Invalid email address format');
    expect(() => sanitizeEmail('@example.com')).toThrow('Invalid email address format');
  });

  it('should reject emails that are too long', () => {
    const longEmail = `${'a'.repeat(250)}@example.com`;
    expect(() => sanitizeEmail(longEmail)).toThrow('Email address too long');
  });
});

describe('sanitizeURL', () => {
  it('should allow valid HTTP/HTTPS URLs', () => {
    expect(sanitizeURL('http://example.com')).toBe('http://example.com/');
    expect(sanitizeURL('https://example.com/path')).toBe('https://example.com/path');
  });

  it('should reject disallowed protocols', () => {
    expect(() => sanitizeURL('javascript:alert(1)')).toThrow('protocol');
    expect(() => sanitizeURL('file:///etc/passwd')).toThrow('protocol');
  });

  it('should allow custom protocols', () => {
    const url = sanitizeURL('ftp://example.com', ['ftp']);
    expect(url).toBe('ftp://example.com/');
  });

  it('should reject invalid URLs', () => {
    expect(() => sanitizeURL('not a url')).toThrow('Invalid URL format');
  });

  it('should reject URLs with suspicious characters in hostname', () => {
    expect(() => sanitizeURL('http://example<script>.com')).toThrow('Invalid URL format');
  });
});

describe('sanitizeCommandArgs', () => {
  it('should allow safe arguments', () => {
    const args = ['ls', '-la', '/home/user'];
    const result = sanitizeCommandArgs(args);
    expect(result).toEqual(args);
  });

  it('should reject arguments with shell metacharacters', () => {
    expect(() => sanitizeCommandArgs(['ls', '; rm -rf /'])).toThrow('dangerous pattern');
    expect(() => sanitizeCommandArgs(['cat', 'file | grep secret'])).toThrow('dangerous pattern');
  });

  it('should reject command substitution', () => {
    expect(() => sanitizeCommandArgs(['echo', '$(whoami)'])).toThrow('dangerous pattern');
    expect(() => sanitizeCommandArgs(['echo', '`whoami`'])).toThrow('dangerous pattern');
  });

  it('should reject variable expansion', () => {
    expect(() => sanitizeCommandArgs(['echo', '${PATH}'])).toThrow('dangerous pattern');
  });

  it('should remove null bytes', () => {
    const result = sanitizeCommandArgs(['test\0arg']);
    expect(result[0]).toBe('testarg');
  });
});

describe('deepSanitize', () => {
  it('should sanitize nested objects', () => {
    const obj = {
      name: '<script>alert(1)</script>',
      details: {
        bio: '<b>Bold</b>',
        tags: ['<i>tag1</i>', 'tag2'],
      },
    };

    const result = deepSanitize(obj);
    expect(result.name).not.toContain('<script>');
    expect(result.details.bio).not.toContain('<b>');
    expect(result.details.tags[0]).not.toContain('<i>');
  });

  it('should handle null and undefined', () => {
    expect(deepSanitize(null)).toBe(null);
    expect(deepSanitize(undefined)).toBe(undefined);
  });

  it('should handle primitive types', () => {
    expect(deepSanitize(123)).toBe(123);
    expect(deepSanitize(true)).toBe(true);
  });

  it('should apply options to all strings', () => {
    const obj = {
      field1: 'a'.repeat(100),
      nested: {
        field2: 'b'.repeat(100),
      },
    };

    const result = deepSanitize(obj, { maxLength: 10 });
    expect(result.field1).toHaveLength(10);
    expect(result.nested.field2).toHaveLength(10);
  });
});
