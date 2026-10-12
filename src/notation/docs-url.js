// Link into the documentation page (a second entry point served next to the app), honouring a sub-path base.
export function docsUrl(anchor = '') {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
  return `${base}docs.html${anchor ? `#${anchor}` : ''}`;
}
