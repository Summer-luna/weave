function legacyCopy(text: string): void {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

// navigator.clipboard only exists on https/localhost and can still be refused; the legacy copy command covers both cases.
export function copyText(text: string): void {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    return;
  }
  legacyCopy(text);
}
