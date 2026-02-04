(() => {
  if (typeof window === 'undefined') return;
  const doc = window.document;
  if (doc && doc.documentElement) {
    doc.documentElement.setAttribute('data-math-visuals-force-mode', 'task');
  }

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  if (params.has('path')) return;

  let entry = params.get('entry') || params.get('app');
  let example = params.get('example') || params.get('eksempel');
  const rawHash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';

  if (rawHash) {
    const [hashPath, hashQuery] = rawHash.split('?');
    const normalizedPath = hashPath.replace(/^\/+/, '').trim();
    const segments = normalizedPath ? normalizedPath.split('/').filter(Boolean) : [];
    if (!entry && segments.length) {
      entry = segments[0];
    }
    if (!example && segments.length > 1) {
      example = segments[1];
    }
    if (hashQuery) {
      const hashParams = new URLSearchParams(hashQuery);
      if (!entry) {
        entry = hashParams.get('entry') || hashParams.get('app');
      }
      if (!example) {
        example = hashParams.get('example') || hashParams.get('eksempel');
      }
    }
  }

  const exampleNumber = Number.isFinite(Number(example)) && Number(example) > 0
    ? Math.trunc(Number(example))
    : null;

  if (!entry) return;

  const normalizedEntry = entry.trim();
  if (!normalizedEntry) return;

  const pathValue = `/${normalizedEntry}${exampleNumber ? `?example=${exampleNumber}` : ''}`;
  params.delete('entry');
  params.delete('app');
  params.delete('example');
  params.delete('eksempel');
  params.set('path', pathValue);

  const nextSearch = params.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
})();
