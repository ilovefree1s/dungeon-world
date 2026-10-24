// ============================================================================
//  DUNGEON WORLD  -  the inventory beside the weapons: armor for the six gear
//  slots (head, shoulders, chest, hands, legs, feet), healing potions, and
//  gold. Everything rolled at an item level (the level of the monster that
//  dropped it) and a rarity, the weapons' five. Armor worn adds armor (less
//  damage taken) and stamina (more health). Kept in the browser like the
//  forge's weapons; the weapons themselves stay in the forge's list.
// ============================================================================
import { RARITIES } from './weaponkit.js';

const KEY = 'dw-inv-v1';
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

export const GEAR_SLOTS = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet'];
export const SLOT_NAME = { head: 'HEAD', shoulders: 'SHOULDERS', chest: 'CHEST', hands: 'HANDS', legs: 'LEGS', feet: 'FEET' };
const SLOT_NOUN = { head: ['HELM', 'HOOD', 'CROWN', 'CAP'], shoulders: ['PAULDRONS', 'MANTLE', 'SPAULDERS'], chest: ['BREASTPLATE', 'TUNIC', 'HAUBERK', 'ROBE'], hands: ['GAUNTLETS', 'GLOVES', 'GRIPS'], legs: ['GREAVES', 'LEGGINGS', 'KILT'], feet: ['BOOTS', 'SABATONS', 'TREADS'] };
const SLOT_WEIGHT = { head: 1, shoulders: 0.8, chest: 1.4, hands: 0.7, legs: 1.2, feet: 0.8 };
const STUFF = [['CLOTH', 0.5], ['LEATHER', 0.75], ['MAIL', 1], ['PLATE', 1.3]];
const ADJ = ['WORN', 'STURDY', 'RIDGED', 'STALWART', 'GLEAMING', 'WARDEN\'S', 'DRAKEHIDE', 'MOONSILVER', 'EMBERFORGED', 'TITAN\'S'];
export const GLYPH_ITEM = { head: '⛑', shoulders: '🛡', chest: '🥋', hands: '🧤', legs: '👖', feet: '🥾', potion: '🧪' };

export const inv = { items: [], equipped: {}, gold: 0, onChange: null, onGear: null };
let nextId = 1;
try { const s = JSON.parse(ls.get(KEY)); if (s) { inv.items = s.items || []; inv.equipped = s.equipped || {}; inv.gold = s.gold || 0; nextId = 1 + Math.max(0, ...inv.items.map(i => i.id || 0), ...Object.values(inv.equipped).map(i => i.id || 0)); } } catch (e) { }
export function persistInv() { ls.set(KEY, JSON.stringify({ items: inv.items, equipped: inv.equipped, gold: inv.gold })); }
const changed = () => { persistInv(); inv.onChange && inv.onChange(); };

// a rarity by the weapons' odds, shifted up with level
export function rollRarity(level) {
  const lv = Math.min(30, level), w = [50 - lv * 1.2, 27, 14 + lv * 0.4, 7 + lv * 0.4, 2 + lv * 0.4];
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; for (; i < w.length - 1; i++) { r -= w[i]; if (r < 0) break; }
  return i;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
// a piece of armor at an item level
export function rollArmor(ilvl) {
  const slot = pick(GEAR_SLOTS), ri = rollRarity(ilvl), rar = RARITIES[ri], [stuff, sk] = pick(STUFF), wgt = SLOT_WEIGHT[slot];
  const armor = Math.max(1, Math.round((2 + ilvl * 1.4) * wgt * sk * rar.mult));
  const stam = ri === 0 ? 0 : Math.max(1, Math.round((1 + ilvl * 0.9) * wgt * (0.6 + ri * 0.25)));
  const adj = ADJ[Math.min(ADJ.length - 1, Math.floor(ri * 2 + Math.random() * 2))];
  return { id: nextId++, kind: 'armor', slot, ilvl, rarity: rar.id, name: `${adj} ${stuff} ${pick(SLOT_NOUN[slot])}`, armor, stam };
}
// a healing potion: heals a share of your health, more the higher its level
export function rollPotion(ilvl) { return { id: nextId++, kind: 'potion', ilvl, rarity: 'common', name: ilvl >= 10 ? 'GREATER HEALING POTION' : 'HEALING POTION', heal: ilvl >= 10 ? 0.6 : 0.4, count: 1 }; }
export const rollGold = ilvl => Math.max(1, Math.round((2 + ilvl * 1.5) * (0.6 + Math.random() * 0.8)));

// into the bags (potions stack); false if the bags are full
export const BAG_SIZE = 24;
export function addItem(it) {
  if (it.kind === 'potion') { const same = inv.items.find(x => x.kind === 'potion' && x.name === it.name); if (same) { same.count += it.count || 1; changed(); return true; } }
  if (inv.items.length >= BAG_SIZE) return false;
  inv.items.push(it); changed(); return true;
}
export function addGold(n) { inv.gold += n; changed(); }
export function dropItem(id) { const i = inv.items.findIndex(x => x.id === id); if (i >= 0) { inv.items.splice(i, 1); changed(); } }
// put a piece on (what was in its slot goes back in the bags)
export function equipItem(id) {
  const i = inv.items.findIndex(x => x.id === id); if (i < 0) return;
  const it = inv.items[i]; if (it.kind !== 'armor') return;
  const old = inv.equipped[it.slot]; inv.items.splice(i, 1);
  if (old) inv.items.push(old);
  inv.equipped[it.slot] = it; changed(); inv.onGear && inv.onGear();
}
export function unequipSlot(slot) { const it = inv.equipped[slot]; if (!it || inv.items.length >= BAG_SIZE) return false; delete inv.equipped[slot]; inv.items.push(it); changed(); inv.onGear && inv.onGear(); return true; }
// drink a potion: returns the share of health it heals
export function usePotion(id) { const it = inv.items.find(x => x.id === id); if (!it || it.kind !== 'potion') return 0; it.count--; if (it.count <= 0) dropItem(id); else changed(); return it.heal; }
// what the worn gear adds up to
export function gearTotals() { let armor = 0, stam = 0; for (const s of GEAR_SLOTS) { const it = inv.equipped[s]; if (it) { armor += it.armor; stam += it.stam; } } return { armor, stam }; }
// the share of a blow the armor turns aside, against an attacker of a level
export const armorCut = (armor, level) => armor / (armor + 30 + level * 12);
