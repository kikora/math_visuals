'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { URLSearchParams } = require('url');
const serverlessExpress = require('@vendia/serverless-express');

function resolveApiRoot() {
  const override = process.env.API_RUNTIME_API_ROOT;
  if (typeof override === 'string' && override.trim()) {
    const trimmed = override.trim();
    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }
    return path.resolve(process.cwd(), trimmed);
  }
  return path.join(__dirname, 'api');
}

const IGNORED_ROUTE_SEGMENTS = new Set(['_lib', '__tests__', '__mocks__']);
const FIGURE_LIBRARY_ASSET_PATTERN = /\.(?:svg|png|jpg|jpeg|gif|webp|avif|json|zip|csv)$/i;
const FRIENDLY_ROUTE_RULES = [
  {
    targetPath: '/api/svg/raw',
    prefixes: ['/bildearkiv/', '/svg/'],
    shouldRewrite(slugPath) {
      return Boolean(slugPath && slugPath !== '/');
    },
  },
  {
    targetPath: '/api/figure-library/raw',
    prefixes: ['/figure-library/'],
    shouldRewrite(slugPath) {
      return FIGURE_LIBRARY_ASSET_PATTERN.test(slugPath || '');
    },
  },
];

function shouldIgnore(relativePath) {
  return relativePath
    .split('/')
    .some(segment => IGNORED_ROUTE_SEGMENTS.has(segment) || segment.startsWith('_'));
}

function wrapHandler(handler, routePath) {
  if (typeof handler !== 'function') {
    throw new TypeError(`Handler for ${routePath} did not export a function`);
  }
  return async function invokeHandler(req, res, next) {
    try {
      const result = handler(req, res);
      if (result && typeof result.then === 'function') {
        await result;
      }
      if (!res.headersSent && !res.writableEnded) {
        res.end();
      }
    } catch (error) {
      next(error);
    }
  };
}

function normalizeRoutePath(filePath, apiRoot) {
  const relative = path.relative(apiRoot, filePath).replace(/\\/g, '/');
  if (relative.startsWith('..')) {
    // Ignore anything outside the bundled api/ folder.
    return null;
  }
  if (shouldIgnore(relative)) {
    return null;
  }
  if (!relative.endsWith('.js')) {
    return null;
  }
  let routePath = relative.slice(0, -3); // drop .js
  if (routePath.endsWith('/index')) {
    routePath = routePath.slice(0, -('/index'.length));
  }
  routePath = routePath.replace(/\/index$/, '');
  if (routePath === '') {
    // No root-level handler is expected; skip.
    return null;
  }
  return path.posix.join('/api', routePath);
}

function discoverHandlers(apiRoot = resolveApiRoot()) {
  const handlers = [];
  if (!fs.existsSync(apiRoot)) {
    return handlers;
  }
  const rootStats = fs.statSync(apiRoot);
  if (!rootStats.isDirectory()) {
    return handlers;
  }
  const entries = fs.readdirSync(apiRoot, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(apiRoot, entry.name);
    if (entry.isDirectory()) {
      registerFromDirectory(entryPath, handlers, apiRoot);
    } else if (entry.isFile()) {
      const routePath = normalizeRoutePath(entryPath, apiRoot);
      if (routePath) {
        handlers.push({ routePath, filePath: entryPath });
      }
    }
  }
  return handlers;
}

function registerFromDirectory(dirPath, handlers, apiRoot) {
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stats = fs.statSync(current);
    if (!stats.isDirectory()) {
      const maybeRoute = normalizeRoutePath(current, apiRoot);
      if (maybeRoute) {
        handlers.push({ routePath: maybeRoute, filePath: current });
      }
      continue;
    }
    const rel = path.relative(apiRoot, current).replace(/\\/g, '/');
    if (shouldIgnore(rel)) {
      continue;
    }
    const children = fs.readdirSync(current, { withFileTypes: true });
    for (const child of children) {
      stack.push(path.join(current, child.name));
    }
  }
}

function registerHandlers(app, apiRoot = resolveApiRoot()) {
  const handlers = discoverHandlers(apiRoot);
  const registered = [];
  handlers.sort((a, b) => a.routePath.localeCompare(b.routePath));
  for (const { routePath, filePath } of handlers) {
    const handler = require(filePath);
    const wrapped = wrapHandler(handler, routePath);
    app.all(routePath, wrapped);
    registered.push({ path: routePath, handler: wrapped });
    if (!routePath.endsWith('/')) {
      const trailingSlashPath = `${routePath}/`;
      app.all(trailingSlashPath, wrapped);
      registered.push({ path: trailingSlashPath, handler: wrapped });
    }
  }
  return registered;
}

function createApp({ apiRoot = resolveApiRoot() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.handlers = registerHandlers(app, apiRoot);

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err && err.statusCode ? err.statusCode : 500);
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    const message = err && err.message ? err.message : 'Internal Server Error';
    res.end(JSON.stringify({ message }));
  });

  return app;
}

let cachedApp;

function ensurePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}

function logEventSummary(event) {
  if (!event || typeof console !== 'object' || typeof console.log !== 'function') {
    return;
  }
  try {
    const requestContext = ensurePlainObject(event.requestContext);
    const httpContext = ensurePlainObject(requestContext.http);
    const summary = {
      rawPath: event.rawPath || null,
      path: event.path || null,
      routeKey: requestContext.routeKey,
      version: event.version,
      queryStringParameters: ensurePlainObject(event.queryStringParameters),
      http: httpContext.method || httpContext.path ? {
        method: httpContext.method,
        path: httpContext.path,
        protocol: httpContext.protocol,
      } : undefined,
    };
    const bodyLength = typeof event.body === 'string' ? event.body.length : 0;
    if (bodyLength > 0) {
      summary.bodyLength = bodyLength;
      if (bodyLength <= 512) {
        summary.bodyPreview = event.body;
      } else {
        summary.bodyPreview = `${event.body.slice(0, 256)}…`;
        summary.bodyPreviewTruncated = true;
      }
    }
    console.log('[ApiRuntimeDebug]', summary);
  } catch (error) {
    console.log('[ApiRuntimeDebug]', {
      message: 'Failed to log event summary',
      error: error && error.message ? error.message : error,
    });
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeRecordOfStrings(record) {
  const normalized = {};
  for (const [key, value] of Object.entries(ensurePlainObject(record))) {
    if (value === undefined || value === null) {
      continue;
    }
    normalized[String(key)] = String(value);
  }
  return normalized;
}

function normalizeRecordOfStringArrays(record) {
  const normalized = {};
  for (const [key, value] of Object.entries(ensurePlainObject(record))) {
    const arrayValue = ensureArray(value).map(item => String(item));
    normalized[String(key)] = arrayValue;
  }
  return normalized;
}

function ensureLeadingSlash(value) {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return value.startsWith('/') ? value : `/${value}`;
}

function normalizePrefix(prefix) {
  if (typeof prefix !== 'string' || !prefix) {
    return null;
  }
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function pathMatchesPrefix(pathValue, prefix) {
  if (!prefix) {
    return false;
  }
  if (pathValue === prefix.slice(0, -1)) {
    return true;
  }
  return pathValue.startsWith(prefix);
}

function extractFriendlySlug(pathValue, prefix) {
  const normalizedPrefix = normalizePrefix(prefix);
  if (!normalizedPrefix) {
    return null;
  }
  if (!pathMatchesPrefix(pathValue, normalizedPrefix)) {
    return null;
  }
  const startIndex = normalizedPrefix.length - 1;
  const remainder = pathValue.slice(startIndex);
  const slugPath = ensureLeadingSlash(remainder);
  if (!slugPath || slugPath === '/') {
    return null;
  }
  return slugPath;
}

function serializeSearchParams(searchParams) {
  const entries = [];
  searchParams.forEach((value, key) => {
    entries.push([String(key), String(value)]);
  });
  return entries;
}

function applySearchParamsToEvent(event, entries) {
  const single = {};
  const multi = {};
  for (const [key, value] of entries) {
    single[key] = value;
    if (!multi[key]) {
      multi[key] = [];
    }
    multi[key].push(value);
  }
  event.queryStringParameters = single;
  event.multiValueQueryStringParameters = multi;
}

function rewriteFriendlyRoutes(event) {
  if (!event || typeof event !== 'object') {
    return;
  }
  const rawPath = ensureString(event.rawPath) || '/';
  const rawQuery = ensureString(event.rawQueryString);
  const params = new URLSearchParams(rawQuery);

  for (const rule of FRIENDLY_ROUTE_RULES) {
    if (!rule || !Array.isArray(rule.prefixes) || !rule.targetPath) {
      continue;
    }
    for (const prefix of rule.prefixes) {
      const slug = extractFriendlySlug(rawPath, prefix);
      if (!slug) {
        continue;
      }
      if (typeof rule.shouldRewrite === 'function' && !rule.shouldRewrite(slug)) {
        continue;
      }
      const existingPathParam = params.get('path');
      if (!existingPathParam) {
        params.set('path', slug);
      }
      const normalizedTarget = ensureLeadingSlash(rule.targetPath) || '/api';
      const entries = serializeSearchParams(params);
      event.rawPath = normalizedTarget;
      event.path = normalizedTarget;
      event.rawQueryString = params.toString();
      applySearchParamsToEvent(event, entries);
      const requestContext = ensurePlainObject(event.requestContext);
      const httpContext = ensurePlainObject(requestContext.http);
      event.requestContext = {
        ...requestContext,
        http: {
          ...httpContext,
          path: normalizedTarget,
        },
      };
      return;
    }
  }
}

function sanitizeHttpContext(httpContext, fallbackPath) {
  const method = ensureString(httpContext.method) || 'GET';
  const pathValue = ensureString(httpContext.path) || fallbackPath;
  const protocol = ensureString(httpContext.protocol) || 'HTTP/1.1';
  const result = {
    ...httpContext,
    method,
    path: pathValue,
    protocol,
  };
  return result;
}

function stripStagePrefix(pathValue, stageName) {
  const pathString = ensureString(pathValue);
  if (!pathString) {
    return pathString;
  }
  const normalizedStage = ensureString(stageName).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalizedStage) {
    return pathString;
  }
  const stagePrefix = `/${normalizedStage}`;
  if (pathString === stagePrefix) {
    return '/';
  }
  const stagePrefixWithSlash = `${stagePrefix}/`;
  if (pathString.startsWith(stagePrefixWithSlash)) {
    const stripped = pathString.slice(stagePrefix.length);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return pathString;
}

function toSafeEvent(event = {}) {
  const headers = normalizeRecordOfStrings(event.headers);
  const multiValueHeaders = normalizeRecordOfStringArrays(event.multiValueHeaders);
  const queryStringParameters = normalizeRecordOfStrings(event.queryStringParameters);
  const multiValueQueryStringParameters = normalizeRecordOfStringArrays(
    event.multiValueQueryStringParameters,
  );
  const pathParameters = ensurePlainObject(event.pathParameters);
  const stageVariables = ensurePlainObject(event.stageVariables);
  const requestContext = ensurePlainObject(event.requestContext);
  const authorizer = ensurePlainObject(requestContext.authorizer);
  const lambdaAuthorizer = ensurePlainObject(authorizer.lambda);
  const httpContext = ensurePlainObject(requestContext.http);
  const rawPathInput = ensureString(event.rawPath) || ensureString(event.path) || '/';
  const rawPath = stripStagePrefix(rawPathInput, requestContext.stage) || '/';
  const rawQueryString = ensureString(event.rawQueryString);
  const normalizedPath = stripStagePrefix(ensureString(event.path), requestContext.stage) || rawPath;
  const httpPath = stripStagePrefix(httpContext.path, requestContext.stage) || rawPath;
  const sanitizedHttpContext = sanitizeHttpContext(
    {
      ...httpContext,
      path: httpPath,
    },
    rawPath,
  );

  const safeEvent = {
    ...event,
    version: ensureString(event.version, '2.0'),
    rawPath,
    path: normalizedPath,
    rawQueryString,
    headers,
    multiValueHeaders,
    cookies: ensureArray(event.cookies).map(cookie => String(cookie)),
    queryStringParameters,
    multiValueQueryStringParameters,
    pathParameters,
    stageVariables,
    isBase64Encoded: Boolean(event.isBase64Encoded),
    requestContext: {
      ...requestContext,
      routeKey:
        ensureString(requestContext.routeKey) || ensureString(event.routeKey) || 'ANY /api',
      authorizer: {
        ...authorizer,
        lambda: lambdaAuthorizer,
      },
      http: sanitizedHttpContext,
    },
  };
  rewriteFriendlyRoutes(safeEvent);
  return safeEvent;
}

exports.handler = async function handler(event, context) {
  if (!cachedApp) {
    cachedApp = createApp();
  }
  const app = cachedApp;
  const safeEvent = toSafeEvent(event);
  logEventSummary(safeEvent);
  return serverlessExpress({ app })(safeEvent, context);
};

exports.toSafeEvent = toSafeEvent;

exports.__internals = {
  createApp,
};
