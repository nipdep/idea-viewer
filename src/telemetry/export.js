export function exportTelemetrySession(collector) {
  if (!collector?.enabled) {
    return false;
  }
  const text = collector.exportText();
  const blob = new Blob([text ? `${text}\n` : ''], { type: 'application/x-ndjson;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = collector.session.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
