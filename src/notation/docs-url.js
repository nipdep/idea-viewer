// Link into the documentation page (a second entry point served next to the app), honouring a sub-path base.
export function docsUrl(anchor = '') {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
  return `${base}docs.html${anchor ? `#${anchor}` : ''}`;
}

export const GUIDE_OPEN_EVENT = 'idea-guide-open';
export const GUIDE_CLOSE_MESSAGE = 'idea-guide-close';

// Click handler for links to the guide: ask the app to show it over the viewer, in the same tab. A new tab could
// not be reliably closed again (browsers sever the opener), and leaving this tab would discard the loaded graph.
export function openGuide(event, anchor = '') {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  window.dispatchEvent(new CustomEvent(GUIDE_OPEN_EVENT, { detail: { anchor } }));
}
