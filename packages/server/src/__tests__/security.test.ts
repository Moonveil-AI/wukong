import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSecurityMiddleware,
  customSecurityHeaders,
  enforceHttps,
} from '../middleware/security.js';

describe('Security Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  describe('createSecurityMiddleware', () => {
    it('should set default security headers', async () => {
      app.use(createSecurityMiddleware({}));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('should enable HSTS when configured', async () => {
      app.use(createSecurityMiddleware({ hsts: true }));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should configure HSTS with custom settings', async () => {
      app.use(
        createSecurityMiddleware({
          hsts: true,
          hstsMaxAge: 86400,
          hstsIncludeSubDomains: false,
        }),
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['strict-transport-security']).toContain('max-age=86400');
      expect(response.headers['strict-transport-security']).not.toContain('includeSubDomains');
    });

    it('should set Content-Security-Policy by default', async () => {
      app.use(createSecurityMiddleware({}));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should allow disabling CSP', async () => {
      app.use(createSecurityMiddleware({ csp: false }));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toBeUndefined();
    });

    it('should allow custom CSP directives', async () => {
      app.use(
        createSecurityMiddleware({
          csp: {
            defaultSrc: ["'self'", 'https://trusted.com'],
          },
        }),
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toContain('https://trusted.com');
    });
  });

  describe('enforceHttps', () => {
    it('should allow HTTPS requests', async () => {
      app.use(enforceHttps(true));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test').set('X-Forwarded-Proto', 'https');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should block HTTP requests when enforcement is enabled', async () => {
      app.use(enforceHttps(true));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HTTPS_REQUIRED');
    });

    it('should allow HTTP requests when enforcement is disabled', async () => {
      app.use(enforceHttps(false));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should detect HTTPS from x-forwarded-proto header', async () => {
      app.use(enforceHttps(true));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test').set('X-Forwarded-Proto', 'https');

      expect(response.status).toBe(200);
    });

    it('should detect HTTPS from x-forwarded-ssl header', async () => {
      app.use(enforceHttps(true));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test').set('X-Forwarded-SSL', 'on');

      expect(response.status).toBe(200);
    });
  });

  describe('customSecurityHeaders', () => {
    it('should add custom security headers', async () => {
      app.use(
        customSecurityHeaders({
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value',
        }),
      );
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-custom-header']).toBe('custom-value');
      expect(response.headers['x-another-header']).toBe('another-value');
    });

    it('should work with no custom headers', async () => {
      app.use(customSecurityHeaders());
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });

    it('should not interfere with other headers', async () => {
      app.use(customSecurityHeaders({ 'X-Custom': 'value' }));
      app.get('/test', (_req, res) => {
        res.setHeader('X-Existing', 'existing-value');
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-custom']).toBe('value');
      expect(response.headers['x-existing']).toBe('existing-value');
    });
  });

  describe('Integration', () => {
    it('should work with all security middleware combined', async () => {
      app.use(createSecurityMiddleware({ hsts: true }));
      app.use(customSecurityHeaders({ 'X-API-Version': '1.0' }));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-api-version']).toBe('1.0');
    });

    it('should work with HTTPS enforcement in middleware chain', async () => {
      app.use(createSecurityMiddleware({ hsts: true }));
      app.use(enforceHttps(true));
      app.use(customSecurityHeaders({ 'X-API-Version': '1.0' }));
      app.get('/test', (_req, res) => res.json({ success: true }));

      const response = await request(app).get('/test').set('X-Forwarded-Proto', 'https');

      expect(response.status).toBe(200);
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-api-version']).toBe('1.0');
    });
  });
});
