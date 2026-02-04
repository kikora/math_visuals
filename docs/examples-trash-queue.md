# Trash queue retry workflow

The examples UI now keeps a local retry queue for trash API requests so that deleting an
example does not silently fail when the backend is unavailable.

## Queue storage

* The queue is stored in `localStorage` under the key
  `mathvis:examples:trashQueue:v1`. Every entry contains the normalized trash record,
  the intended append/prepend mode, the `limit` that was used when the request was
  created, and a `queuedAt` timestamp.
* When `localStorage` is not available (for example in private browsing) the queue falls
  back to an in-memory map. These entries are lost on refresh but the queue API behaves
  consistently, so callers can still rely on the retry interface.

## When entries are added

`addExampleToTrash` tries to POST directly to `/api/examples/trash`. If the request fails
or the API returns a falsy response the entry is queued and the user receives a toast
explaining that the deletion will be sent later. The queue exposes a global helper
(`window.MathVisExamplesTrashQueue`) so that other pages, such as the archive viewer,
can inspect or flush pending entries.

## Automatic retries

The retry helper registers listeners for `focus`, `online`, `visibilitychange`, and the
initial page load. When any of these events fire the helper attempts to flush the queue
silently. A manual `flushPending({ silent: false })` call is also available to surface
success or failure directly to the user.

## Archive viewer integration

When the archive viewer (`svg-arkiv.js`) fails to fetch the trash list it now shows a
warning banner indicating that the archive may be incomplete. If queued entries are
present the banner also renders a "Send lagrede slettinger nå" button. Pressing the
button flushes the queue using the shared helper (or a local fallback if the helper is
not available) and refreshes the trash list when the upload succeeds.
