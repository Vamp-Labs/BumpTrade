export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function row(label: string, value: string, valueClass = ''): HTMLElement {
  const wrap = h('div', 'on-row');
  wrap.append(h('span', 'on-label', label), h('span', `on-value ${valueClass}`.trim(), value));
  return wrap;
}

export function externalLink(label: string, href: string): HTMLAnchorElement {
  const link = h('a', 'on-link', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function button(label: string, className = '', onClick?: () => void): HTMLButtonElement {
  const node = h('button', `on-btn ${className}`.trim(), label);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

export function overlayRoot(): HTMLElement {
  const existing = document.getElementById('online-root');
  if (existing) return existing;
  const root = h('div', 'on-root');
  root.id = 'online-root';
  (document.getElementById('app') ?? document.body).appendChild(root);
  return root;
}

export function safeIconSrc(icon: string): string | null {
  return icon.startsWith('data:image/') ? icon : null;
}
