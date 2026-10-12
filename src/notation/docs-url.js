// Link into the documentation page (a second entry point served next to the app), honouring a sub-path base.
export function docsUrl(anchor = '') {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');
  return `${base}docs.html${anchor ? `#${anchor}` : ''}`;
}

// Click handler for links to the guide: open it in one named tab (reused on later clicks) so that "go back" can
// close it and return to the viewer tab, whose loaded graph a plain same-tab navigation would throw away.
export function openGuide(event, anchor = '') {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const opened = window.open(docsUrl(anchor), 'idea-viewer-guide');
  if (opened) {
    event.preventDefault();
    opened.focus();
  }
}
