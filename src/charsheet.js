// ============================================================================
//  DUNGEON WORLD  -  the character sheet and the bags, after the way an MMO
//  lays them out: C opens the sheet (your hero turning on a stand, the gear
//  slots down each side, the numbers below), B opens the bags (a grid of
//  sixteen slots holding the weapons you've forged or found; click one for
//  its picture and numbers, then wield it, take it to the forge, or drop it).
//  The weapons live in the forge's saved list; this is another window onto it.
// ============================================================================
import * as THREE from 'three';
import { forge, wieldSaved, unwield, deleteSaved, loadSaved, equippedSpec } from './forge.js';
import { TYPES, MATERIALS, AURAS, HERO_NAME, rarityOf, clsOf, statsOf, buildForged, plainStats, dpsOf, hitOf } from './weaponkit.js';
import { buildHero, equipHeroWeapon, animHero } from './dh/models.js';
import { kay, makeKayHero, animKay, holdForged } from './kayhero.js';
import { Turntable } from './turntable.js';
import { stats, xpToNext } from './combat.js';
import { sfx } from './audio.js';
import { inv, equipItem, unequipSlot, dropItem, usePotion, gearTotals, armorCut, GLYPH_ITEM, SLOT_NAME, BAG_SIZE } from './inventory.js';
import { RARITIES } from './weaponkit.js';

const $ = id => document.getElementById(id);
const GLYPH = { sword: '🗡', greatsword: '⚔', dagger: '🔪', axe: '🪓', hammer: '🔨', mace: '🏏', staff: '🪄', wand: '✨', bow: '🏹', crossbow: '🎯' };
const SLOTS = [['HEAD', 'head'], ['SHOULDERS', 'shoulders'], ['CHEST', 'chest'], ['HANDS', 'hands'], ['LEGS', 'legs'], ['FEET', 'feet'], ['MAIN HAND', 'main'], ['OFF HAND', 'off']];

export class CharSheet {
  constructor(player) {
    this.player = player; this.open = false; this.tab = 'char'; this.picked = -1;
    this.heroView = new Turntable($('csGl')); this.itemView = new Turntable($('bagGl'));
    this.onClose = null; this.onForge = null;
    $('csClose').addEventListener('click', () => this.close());
    $('tabChar').addEventListener('click', () => this.show('char'));
    $('tabBags').addEventListener('click', () => this.show('bags'));
    $('bagWield').addEventListener('click', () => { if (typeof this.picked === 'string' || this.picked < 0) return; wieldSaved(this.picked); sfx('rare'); this.render(); });
    $('bagUnwield').addEventListener('click', () => { if (typeof this.picked === 'string' || this.picked < 0) return; unwield(clsOf(forge.saved[this.picked])); sfx('pickup'); this.render(); });
    $('bagForge').addEventListener('click', () => { if (typeof this.picked === 'string' || this.picked < 0) return; loadSaved(this.picked); sfx('pickup'); this.onForge && this.onForge(); });
    $('bagDrop').addEventListener('click', () => { if (typeof this.picked === 'string' || this.picked < 0) return; deleteSaved(this.picked); this.picked = -1; sfx('nope'); this.render(); });
  }
  show(tab) {
    this.tab = tab; this.open = true; $('char').hidden = false;
    $('tabChar').classList.toggle('on', tab === 'char'); $('tabBags').classList.toggle('on', tab === 'bags');
    $('csBody').hidden = tab !== 'char'; $('bagBody').hidden = tab !== 'bags';
    this.render();
  }
  close() { this.open = false; $('char').hidden = true; this.heroView.stop(); this.itemView.stop(); this.onClose && this.onClose(); }
  render() {
    if (!this.open) return;
    if (this.tab === 'char') this.renderChar(); else this.renderBags();
  }
  // ---------------------------------------------------------------- the sheet
  renderChar() {
    const p = this.player, cls = p.cls, have = equippedSpec(cls), st = have ? statsOf(have) : null;
    $('csName').textContent = HERO_NAME[cls]; $('csLevel').textContent = `LEVEL ${stats.level}`;
    // the hero on the stand, idling, with what's in hand
    if (cls === 2 && kay.ready) {
      const m = makeKayHero(2.15); if (have) holdForged(m, buildForged(have));
      let last = performance.now();
      this.heroView.showModel(m, () => { const now = performance.now(); animKay(m, Math.min(0.05, (now - last) / 1000), { speed: 0, cast: -1 }); last = now; }, { spin: 0.35, sway: false, face: 0.4, wobble: 0.5, dist: 1.4 });
    } else {
    const m = buildHero(cls); equipHeroWeapon(m, cls, 1, 0);
    if (have) { const u = m.userData, hold = [u.sword, u.staff, u.bow][cls]; for (const c of [...hold.children]) hold.remove(c); const w = buildForged(have); if (cls === 0) w.rotation.x = Math.PI / 2; if (cls === 1 && have.type === 'staff') { w.position.y = -0.55 * (have.length || 1); w.rotation.z = -0.1; } hold.add(w); u.wtick = w.userData.tick; if (cls === 0) { u.bladeMat = w.userData.bladeMat; u.bladeBase = u.bladeMat.emissive.clone(); u.bladeBaseI = u.bladeMat.emissiveIntensity; } if (cls === 1) { u.orbMat = w.userData.orbMat; u.orb = w.userData.orb; } if (cls === 2) { u.string = w.userData.string; u.stringZ = w.userData.stringZ; } }
    m.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    let walk = 0;
    this.heroView.showModel(m, t => { walk += 0.016 * 2; animHero(m, t, { walk, move: 0.08, roll: 0, swing: -1, cast: -1, whirl: false }); }, { spin: 0.35, sway: false, face: 0.4, wobble: 0.5, dist: 1.4 });
    }
    // the slots: gear comes in a later stage; the hands hold what the forge gave
    const grid = $('csSlots'); grid.innerHTML = '';
    for (const [label, id] of SLOTS) {
      const el = document.createElement('div'); el.className = 'cslot';
      let inner = `<span class="l">${label}</span><span class="v empty">—</span>`;
      const worn = inv.equipped[id];
      if (worn) { const rr = RARITIES.find(r => r.id === worn.rarity) || RARITIES[0]; inner = `<span class="l">${label} · LV ${worn.ilvl}</span><span class="v" style="color:${rr.color}">${GLYPH_ITEM[id]} ${worn.name}</span>`; el.style.boxShadow = `inset 0 0 0 2px ${rr.color}`; el.title = `ARMOR ${worn.armor} · STAMINA ${worn.stam} (click to take it off)`; el.style.cursor = 'pointer'; el.addEventListener('click', () => { if (unequipSlot(id)) { sfx('pickup'); this.render(); } }); }
      if (id === 'main') {
        if (have) { const rr = rarityOf(have); inner = `<span class="l">${label}</span><span class="v" style="color:${rr.color}">${GLYPH[have.type] || '•'} ${have.name || 'UNNAMED'}</span>`; el.style.boxShadow = `inset 0 0 0 2px ${rr.color}`; }
        else inner = `<span class="l">${label}</span><span class="v">${['A PLAIN SWORD', 'A PLAIN STAFF', 'A PLAIN BOW'][cls]}</span>`;
      }
      if (id === 'off') inner = `<span class="l">${label}</span><span class="v">${['SHIELD', 'ORB', 'QUIVER'][cls]}</span>`;
      el.innerHTML = inner; grid.appendChild(el);
    }
    // the numbers
    const w = st || plainStats(cls);
    $('csStats').innerHTML = [
      ['HEALTH', `${stats.hp} / ${stats.maxHp}`], ['EXPERIENCE', `${stats.xp} / ${xpToNext()}`], ['KILLS', stats.kills],
      ['DPS', dpsOf(w, cls, stats.level)], ['HIT', `${Math.round(hitOf(w, cls, stats.level))} (x${w.dmg})`], [cls === 0 ? 'SWING' : 'SHOT', `every ${w.time.toFixed(2)}s`],
      ['ARMOR', `${gearTotals().armor} (−${Math.round(armorCut(gearTotals().armor, stats.level) * 100)}%)`], ['STAMINA', gearTotals().stam], ['GOLD', inv.gold], ['AURA', w.aura && w.aura !== 'none' ? w.aura.toUpperCase() : '—'],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }
  // ---------------------------------------------------------------- the bags
  renderBags() {
    const grid = $('bagGrid'); grid.innerHTML = '';
    // the weapons first (picked: their index), then armor and potions (picked: 'i' + their id)
    const cells = [...forge.saved.map((w, i) => ({ w, key: i })), ...inv.items.map(it => ({ it, key: 'i' + it.id }))];
    const total = Math.max(16 + BAG_SIZE, cells.length);
    for (let n = 0; n < total; n++) {
      const cell = cells[n], el = document.createElement('button'); el.type = 'button'; el.className = 'bslot';
      if (cell && cell.w) {
        const w = cell.w, i = cell.key, rr = rarityOf(w), c = clsOf(w), eq = forge.equipped[c] === i;
        el.innerHTML = `<span class="g">${GLYPH[w.type] || '•'}</span><span class="n">${(w.name || 'UNNAMED').slice(0, 14)}</span>${eq ? '<i class="eq">WIELDED</i>' : ''}`;
        el.style.boxShadow = `inset 0 0 0 2px ${rr.color}`; el.style.color = rr.color; el.title = w.name || '';
        if (i === this.picked) el.classList.add('on');
        el.addEventListener('click', () => { this.picked = i; sfx('pickup'); this.renderBags(); });
      } else if (cell) {
        const it = cell.it, rr = RARITIES.find(r => r.id === it.rarity) || RARITIES[0];
        el.innerHTML = `<span class="g">${GLYPH_ITEM[it.kind === 'armor' ? it.slot : 'potion']}</span><span class="n">${it.name.slice(0, 14)}</span>${it.count > 1 ? `<i class="eq" style="left:auto;right:4px">${it.count}</i>` : ''}`;
        el.style.boxShadow = `inset 0 0 0 2px ${rr.color}`; el.style.color = rr.color; el.title = it.name;
        if (cell.key === this.picked) el.classList.add('on');
        el.addEventListener('click', () => { this.picked = cell.key; sfx('pickup'); this.renderBags(); });
      } else { el.classList.add('empty'); el.disabled = true; }
      grid.appendChild(el);
    }
    $('bagCount').textContent = `WEAPONS ${forge.saved.length} / 16 · ITEMS ${inv.items.length} / ${BAG_SIZE} · 🪙 ${inv.gold}`;
    // an item picked: its icon, its numbers against what's worn, equip / drink / drop
    if (typeof this.picked === 'string') {
      const it = inv.items.find(x => 'i' + x.id === this.picked);
      $('bagDetail').hidden = !it; this.itemView.stop(); $('bagGl').hidden = true; $('bagIcon').hidden = !it;
      for (const b of ['bagWield', 'bagUnwield', 'bagForge']) $(b).hidden = true;
      if (!it) return;
      const rr = RARITIES.find(r => r.id === it.rarity) || RARITIES[0];
      $('bagIcon').textContent = GLYPH_ITEM[it.kind === 'armor' ? it.slot : 'potion'];
      $('bagName').textContent = it.name; $('bagName').style.color = rr.color;
      if (it.kind === 'armor') {
        const cur = inv.equipped[it.slot];
        $('bagLine').textContent = `${rr.name} · ${SLOT_NAME[it.slot]} · ITEM LEVEL ${it.ilvl}`;
        const row = (k, v, b) => { let d = ''; if (b != null) { const dl = v - b; d = `<em style="color:${dl > 0 ? '#5ce65c' : dl < 0 ? '#ff6a55' : 'var(--dim)'}">${dl > 0 ? '▲ +' : dl < 0 ? '▼ ' : '= '}${dl || ''}</em>`; } return `<div><span>${k}</span><b>${v}</b>${d}</div>`; };
        $('bagStats').innerHTML = row('ARMOR', it.armor, cur ? cur.armor : 0) + row('STAMINA', it.stam, cur ? cur.stam : 0);
        $('bagUse').textContent = 'EQUIP'; $('bagUse').hidden = false;
        $('bagUse').onclick = () => { equipItem(it.id); this.picked = -1; sfx('rare'); this.renderBags(); };
      } else {
        $('bagLine').textContent = `HEALS ${Math.round(it.heal * 100)}% OF YOUR HEALTH · ${it.count} IN THE BAG`;
        $('bagStats').innerHTML = '';
        $('bagUse').textContent = 'DRINK'; $('bagUse').hidden = false;
        $('bagUse').onclick = () => { const h = usePotion(it.id); if (h) { stats.hp = Math.min(stats.maxHp, stats.hp + Math.round(stats.maxHp * h)); sfx('drink'); } this.renderBags(); };
      }
      $('bagDrop').onclick = () => { dropItem(it.id); this.picked = -1; sfx('nope'); this.renderBags(); };
      return;
    }
    $('bagGl').hidden = false; $('bagIcon').hidden = true; $('bagUse').hidden = true;
    $('bagDrop').onclick = null;
    const w = forge.saved[this.picked];
    $('bagDetail').hidden = !w;
    if (!w) { this.itemView.stop(); return; }
    const t = TYPES.find(x => x.id === w.type), mt = MATERIALS.find(x => x.id === w.material), a = AURAS.find(x => x.id === w.aura), rr = rarityOf(w), st = statsOf(w), c = clsOf(w), eq = forge.equipped[c] === this.picked;
    $('bagName').textContent = w.name || 'UNNAMED'; $('bagName').style.color = rr.color;
    $('bagLine').textContent = `${rr.name} · ${mt ? mt.name : ''} ${t ? t.name : ''}${a && a.id !== 'none' ? ' · ' + a.name + ' AURA' : ''} · FOR THE ${HERO_NAME[c]}`;
    const have = equippedSpec(c), cur = have && !eq ? statsOf(have) : null;
    const row = (k, v, b, post = '', less = false) => { let d = ''; if (b != null && !eq) { const dl = +(v - b).toFixed(2), good = less ? -dl : dl; d = `<em style="color:${good > 0 ? '#5ce65c' : good < 0 ? '#ff6a55' : 'var(--dim)'}">${good > 0 ? '▲' : good < 0 ? '▼' : '='} ${dl > 0 ? '+' : ''}${dl || ''}</em>`; } return `<div><span>${k}</span><b>${v}${post}</b>${d}</div>`; };
    $('bagStats').innerHTML = row('DPS', dpsOf(st, c, stats.level), cur ? dpsOf(cur, c, stats.level) : null) + row('HIT', Math.round(hitOf(st, c, stats.level)), cur ? Math.round(hitOf(cur, c, stats.level)) : null) + row(c === 0 ? 'SWING' : 'SHOT', st.time, cur ? cur.time : null, 's', true) + (c !== 0 ? row('SHOT SPD', st.shot, cur ? cur.shot : null) : '');
    $('bagWield').hidden = eq; $('bagUnwield').hidden = !eq; $('bagForge').hidden = false;
    this.itemView.show(w);
  }
}
