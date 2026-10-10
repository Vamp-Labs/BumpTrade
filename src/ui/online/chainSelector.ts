import { CHAIN_IDS, CHAIN_META, getActiveChain, type ChainId } from '../../chain/port';
import { h } from './dom';

export function renderChainSelector(parent: HTMLElement, onSelect: (id: ChainId) => void): void {
  if (CHAIN_IDS.length < 2) return;
  const active = getActiveChain().id;
  const bar = h('div', 'on-segs on-chains');
  for (const id of CHAIN_IDS) {
    const seg = h('button', `on-seg${id === active ? ' active' : ''}`, CHAIN_META[id].pill);
    seg.type = 'button';
    seg.addEventListener('click', () => {
      if (id !== getActiveChain().id) onSelect(id);
    });
    bar.appendChild(seg);
  }
  parent.appendChild(bar);
}
