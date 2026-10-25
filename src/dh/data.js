// ============================================================================
//  DUNGEON HEART  -  data: the tables of the SNES game (snes/src/game.c in
//  ilovefree1s/dungeon-loot), unchanged, so the 3D game plays the same.
// ============================================================================

export const MAP_W = 16, MAP_H = 11, PLAY_Y = 32;
export const MAXM = 6, WARDEN_MAX = 3, MAXI = 8, MAXP = 16, MAXB = 6, MAXBN = 4, MAXOBJ = 10;
export const BOSS_ROOM = 6, LAST_FLOOR = 50;

// map cells
export const T_FLOOR = 0, T_WALL = 1, T_PILLAR = 2, T_DOOR = 3, T_STAIRS = 4, T_FLOOR2 = 5, T_DOORWAY = 6,
  T_HAZARD = 7, T_PIT = 8, T_BRIDGE = 9, T_OBJ = 10, T_CRACK = 11;
// walls, pillars and closed doors block shots; for walking pits too
export const TILE_SOLID = [0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0];
export const TILE_WALK = [0, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0];

export const DIR_DOWN = 0, DIR_UP = 1, DIR_RIGHT = 2, DIR_LEFT = 3;

// monsters
export const M_GOBLIN = 18, M_GOBARCHER = 19;
export const M_NONE = 0, M_SLIME = 1, M_BAT = 2, M_SKEL = 3, M_SPIDER = 4, M_GHOST = 5, M_WIZARD = 6, M_IMP = 7,
  M_GOLEM = 8, M_ARCHER = 9, M_FIRESPRITE = 10, M_VBAT = 11, M_WISP = 12, M_HELLCRAB = 13, M_SLIMEKING = 14,
  M_DEMON = 15, M_WRAITH = 16, M_INFERNO = 17, NMON = 17;
export const MON_NAME = ['', 'SLIME', 'BAT', 'SKELETON', 'SPIDER', 'GHOST', 'WIZARD', 'IMP', 'GOLEM', 'ARCHER',
  'FIRE SPRITE', 'VAMPIRE BAT', 'WISP', 'HELL CRAB', 'SLIME KING', 'DEMON', 'WRAITH', 'INFERNO', 'GOBLIN', 'GOBLIN ARCHER'];
export const MON_BASE_HP = [0, 4, 3, 8, 5, 6, 6, 5, 30, 7, 4, 5, 8, 40, 45, 25, 12, 14, 6, 5];
export const MON_BASE_ATK = [0, 2, 3, 4, 4, 5, 5, 4, 10, 5, 6, 7, 7, 9, 9, 13, 10, 11, 4, 4];
export const MON_BASE_XP = [0, 2, 3, 5, 4, 5, 6, 6, 10, 8, 7, 9, 9, 11, 12, 13, 13, 14, 5, 5];
// the depth each monster first appears at
export const MON_UNLOCK = [0, 1, 2, 3, 5, 8, 12, 16, 20, 26, 34, 40, 46, 52, 58, 66, 74, 84, 1, 1];
// how far a type's body reaches past its 16x16 box: each side / above (for the sword and shots)
export const MON_HIT_W = [0, 3, 6, 1, 6, 5, 4, 2, 4, 1, 0, 6, 5, 6, 6, 6, 4, 3];
export const MON_HIT_H = [0, 4, 1, 12, 4, 14, 15, 7, 13, 12, 9, 2, 16, 3, 9, 13, 15, 16];
// boss arts: demon ogre, spider demon, flame lord, shadow wraith, slime king, tower king
export const BOSS_HIT_W = [14, 14, 14, 14, 14, 14];
export const BOSS_HIT_H = [17, 5, 9, 17, 0, 17];
export const BOSS_ART_NAME = ['DEMON OGRE', 'SPIDER DEMON', 'FLAME LORD', 'SHADOW WRAITH', 'SLIME KING', 'TOWER KING'];

// floor modifiers
export const FM_CALM = 0, FM_FAST = 1, FM_TOUGH = 2, FM_FIERCE = 3, FM_SWARM = 4, FM_TREASURE = 5;
export const MOD_NAME = ['CALM HALLS', 'FAST FOES', 'TOUGH FOES', 'FIERCE FOES', 'SWARMING', 'TREASURE!'];

// gear
export const K_NONE = 0, K_WEAPON = 1, K_ARMOR = 2, K_SHIELD = 3, K_BOOTS = 4, K_GLOVES = 5, K_HELMET = 6,
  K_TRINKET = 7, K_POTION = 8, K_GOLD = 9, K_BOMBS = 10, NGEAR = 7, NGEAR_DROP = 6; // (K_BOMBS: a pack of bombs on the floor)
export const SP_NONE = 0, SP_VAMPIRE = 1, SP_CRIT = 2, SP_QUICK = 3, SP_REGEN = 4, SP_THORNS = 5, SP_BLOCK = 6;
export const SPEC_NAME = ['', 'VAMPIRE', 'CRIT', 'QUICK', 'REGEN', 'THORNS', 'BLOCK'];
export const SPEC_DESC = ['', 'Heal 1 HP per hit', '25% double damage', 'Roll recharges 2x', 'Heal over time',
  'Hurt who hits you', '25% block a hit'];
// the five gear stats (an item rolls up to three). Each class has a main stat: its damage.
export const ST_STR = 1, ST_DEX = 2, ST_INT = 3, ST_STA = 4, ST_DEF = 5;
export const STAT_NAME = ['', 'STR', 'DEX', 'INT', 'STA', 'DEF'];
export const STAT_LONG = ['', 'STRENGTH', 'DEXTERITY', 'INTELLIGENCE', 'STAMINA', 'DEFENSE'];
export const STAT_COLOR = ['', '#ff7a5a', '#86e34b', '#b57cff', '#ffb26a', '#7ab8ff'];
export const MAIN_STAT = [ST_STR, ST_INT, ST_DEX]; // warrior, mage, hunter
export const BAG = 16, RAR_RARE = 2, RAR_EPIC = 3, RAR_LEG = 4, MAXPOT = 5;
export const RAR_NAME = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
export const RAR_COLOR = ['#d9dde3', '#5fe36a', '#4fa8ff', '#b57cff', '#ffa53a'];
export const RAR_LVL = [0, 2, 4, 6, 8];
// head start per slot (weapon, armor, shield, boots, gloves, helmet, trinket)
export const KIND_LVL = [0, 8, 8, 16, 8, 8, 0];
export const FINE = 6, FINE_SPD = 8;
export const LVL_MAX = 250;

export const WEAPON_NAME = [
  'SHORT SWORD', 'BROADSWORD', 'LONGSWORD', 'FALCHION', 'CLAYMORE', 'GREATSWORD', 'FLAMEBLADE', 'RUNEBLADE',
  'OAK STAFF', 'ASH STAFF', 'BONE STAFF', 'RUNE STAFF', 'EMBER STAFF', 'FROST STAFF', 'STAR STAFF', 'ELDER STAFF',
  'SHORTBOW', 'HUNTING BOW', 'LONGBOW', 'RECURVE BOW', 'WAR BOW', 'ELVEN BOW', 'STORM BOW', 'DRAGON BOW'];
// legendary weapons have their own names (by tier: flame, frost, void, sun, then again)
export const LEG_WEAPON_NAME = [
  'DRAGONFANG', 'FROSTBITE', 'SOULREAVER', 'SUNBREAKER', 'HELLFIRE EDGE', "WINTER'S END", 'VOIDSTAR', 'DAWNBRINGER',
  'PHOENIX ROD', 'GLACIER SPIRE', 'VOID SCEPTER', 'STAR OF DAWN', 'INFERNO STAFF', 'FROSTWEAVER', 'ABYSS STAFF', 'CELESTIA',
  'DRAGONWING', 'FROSTWIND', 'SHADOWSTRING', 'SUNSTRIKE', 'PHOENIX BOW', 'WINTER HORN', 'NIGHTFALL', 'SOLARIS'];
export const LEG_ARMOR_NAME = [
  'DRAGONPLATE', 'FROSTGUARD', 'VOIDMAIL', 'SUNPLATE', 'INFERNO PLATE', "WINTER'S AEGIS", 'NIGHTMAIL', 'DAWN PLATE',
  'PHOENIX ROBE', 'GLACIER MANTLE', 'VOIDWEAVE', 'STARWEAVE', 'EMBER ROBE', 'FROSTSILK', 'ABYSS ROBE', 'CELESTIAL ROBE',
  'DRAGONHIDE COAT', 'FROSTFUR', 'SHADOWSKIN', 'SUNHIDE', 'PHOENIX COAT', 'WINTER PELT', 'NIGHTSTALKER', 'SOLAR COAT'];
export const LEG_HELMET_NAME = ['DRAGON CROWN', 'FROST CROWN', 'VOID HALO', 'SUN CROWN', 'INFERNO HELM', 'WINTER CROWN', 'NIGHT HALO', 'DAWN CROWN'];
export const LEG_SHIELD_NAME = [
  'DRAGON AEGIS', 'FROSTWALL', 'VOID BULWARK', 'SUNGUARD', 'INFERNO WALL', "WINTER'S WARD", 'NIGHTSHIELD', 'DAWNSHIELD',
  'PHOENIX EYE', 'FROZEN HEART', 'EYE OF THE VOID', 'SUNSTONE', 'INFERNO ORB', 'ICE HEART', 'ABYSS ORB', 'STAR HEART',
  'EMBER QUIVER', 'FROST QUIVER', 'VOID QUIVER', 'SUN QUIVER', 'PHOENIX QUIVER', 'WINTER QUIVER', 'NIGHT QUIVER', 'DAWN QUIVER'];
export const LEG_BOOTS_NAME = ['FLAMEWALKERS', 'FROSTSTRIDERS', 'VOIDSTEPS', 'SUNRUNNERS', 'EMBERTREADS', 'ICEWALKERS', 'NIGHTSTEPS', 'DAWNRUNNERS'];
export const LEG_GLOVES_NAME = ['DRAGONGRIPS', 'FROSTFISTS', 'VOIDCLAWS', 'SUNGRIPS', 'INFERNO FISTS', 'WINTER CLAWS', 'NIGHTGRIPS', 'DAWN FISTS'];
export const LEG_TRINKET_NAME = ['PHOENIX FEATHER', 'HEART OF WINTER', 'EYE OF NIGHT', 'SUN MEDALLION'];
export const ARMOR_NAME = [
  'CLOTH', 'LEATHER', 'STUDDED', 'CHAIN', 'SCALE', 'PLATE', 'MITHRIL', 'DRAGONSCALE',
  'CLOTH ROBE', 'LINEN ROBE', 'SILK ROBE', 'MYSTIC ROBE', 'SAGE ROBE', 'RUNE ROBE', 'ARCHON ROBE', 'STAR ROBE',
  'HIDE VEST', 'LEATHER', 'STUDDED HIDE', 'RANGER COAT', 'SCALE HIDE', 'SHADOW HIDE', 'WIND CLOAK', 'DRAGONHIDE'];
export const SHIELD_NAME = [
  'BUCKLER', 'ROUND SHIELD', 'KITE SHIELD', 'HEATER', 'TOWER SHIELD', 'SPIKED SHIELD', 'MIRROR SHIELD', 'AEGIS',
  'GLASS ORB', 'CRYSTAL ORB', 'MOON ORB', 'STORM ORB', 'SUN ORB', 'VOID ORB', 'STAR ORB', 'ELDER ORB',
  'QUIVER', 'HIDE QUIVER', 'RANGER QUIVER', 'OAK QUIVER', 'WIND QUIVER', 'SHADOW QUIVER', 'STORM QUIVER', 'DRAGON QUIVER'];
export const BOOTS_NAME = ['SANDALS', 'BOOTS', 'RANGER BOOTS', 'TRAIL BOOTS', 'WIND BOOTS', 'SHADOW BOOTS', 'STORM BOOTS', 'COMET BOOTS'];
export const GLOVES_NAME = ['WRAPS', 'GLOVES', 'GRIPS', 'GAUNTLETS', 'WAR GRIPS', 'IRON FISTS', 'TITAN GRIPS', 'DRAGON CLAWS'];
export const HELMET_NAME = ['LEATHER CAP', 'IRON CAP', 'HELM', 'GREAT HELM', 'WAR HELM', 'HORNED HELM', 'RUNE HELM', 'DRAGON HELM'];
export const TRINKET_NAME = ['CHARM', 'CHARM', 'AMULET', 'TALISMAN', 'RELIC'];
export const KIND_NAME = ['', 'WEAPON', 'ARMOR', 'SHIELD', 'BOOTS', 'GLOVES', 'HELMET', 'TRINKET'];

// themes
export const THEME_NAME = ['STONE KEEP', 'MOSSY HALLS', 'FROST TOMB', 'EMBER DEPTHS', 'BONE CRYPT', 'SAND VAULT',
  'CRYSTAL CAVE', 'SHADOW HALLS', 'BLOOD SPIRE', 'STORM TOWER'];
export const THEME_WORD = ['STONE', 'MOSS', 'FROST', 'EMBER', 'BONE', 'SAND', 'CRYSTAL', 'SHADOW', 'BLOOD', 'STORM'];
export const HZ_NONE = 255, HZ_SPIKES = 0, HZ_THORNS = 1, HZ_ICE = 2, HZ_LAVA = 3, HZ_BONES = 4, HZ_SAND = 5,
  HZ_CRYSTAL = 6, HZ_DARK = 7, HZ_BLOOD = 8, HZ_STORM = 9;
export const HZ_PATCHES = [3, 3, 2, 3, 0, 3, 0, 0, 3, 0];
export const HZ_TEXT = ['SPIKE TRAPS! WATCH THEM RISE', 'THORNS SLOW AND SCRATCH YOU', 'SLIPPERY ICE! HARD TO STOP',
  'LAVA BURNS! ROLL ACROSS IT', 'THE DEAD RISE! SMASH BONES', 'QUICKSAND! IT PULLS YOU IN', 'CRYSTAL THROWS SHOTS BACK',
  '', 'BLOOD POOLS HEAL MONSTERS', 'LIGHTNING! GET OFF THE MARK'];

// special rooms
export const SP_TREASURE = 1, SP_SHRINE = 2, SP_FOUNTAIN = 3, SP_ARENA = 4, SP_TRAP = 5;
export const SP_TEXT = ['', 'A TREASURE ROOM!', 'A SHRINE: GOLD FOR A BLESSING', 'A HEALING FOUNTAIN',
  'THE ARENA: SURVIVE 3 WAVES', 'A TRAPPED ROOM! MIND THE WALL'];
export const OBJ_CHEST = 1, OBJ_CHEST_OPEN = 2, OBJ_SHRINE = 3, OBJ_SHRINE_USED = 4, OBJ_FOUNTAIN = 5,
  OBJ_FOUNTAIN_DRY = 6, OBJ_CRACK = 7, OBJ_LAUNCHER = 8, OBJ_ALCH_L = 9, OBJ_ALCH_R = 10, OBJ_GONE = 255,
  // the dungeons': a great chest, a block to push onto a floor plate, a crystal switch (only the
  // boomerang reaches it), a cracked wall only bombs open
  OBJ_BIGCHEST = 11, OBJ_BIGCHEST_OPEN = 12, OBJ_BLOCK = 13, OBJ_PLATE = 14, OBJ_PLATE_ON = 15, OBJ_CRYSTAL = 16, OBJ_CRYSTAL_ON = 17,
  OBJ_BOMBWALL = 18, OBJ_POST = 19, // (a grapple post: the chain catches on it)
  OBJ_PEGS = 20, OBJ_BRAZIER = 21, OBJ_BRAZIER_LIT = 22; // (wooden pegs in a doorway; a brazier the ember wand lights)
// the dungeons' doors, as drawn (sim.dg_dk): none, open, a shutter, a small-key lock, the boss lock, a cracked wall
export const DK_NONE = 0, DK_OPEN = 1, DK_SHUT = 2, DK_LOCK = 3, DK_BOSS = 4, DK_CRACK = 5, DK_PEGS = 6; // (pegs: the hammer pounds them down)

// elites
export const EL_FRENZIED = 1, EL_ARMORED = 2, EL_SPLITTING = 3, EL_VAMPIRIC = 4;
export const ELITE_NAME = ['', 'FRENZIED', 'ARMORED', 'SPLITTING', 'VAMPIRIC'];
export const ELITE_COLOR = ['#ffffff', '#ff6a3c', '#9fd0ff', '#7dff86', '#ff3a6a'];

// classes and talents
export const CLASS_NAME = ['WARRIOR', 'MAGE', 'HUNTER'];
export const NTAL = 15;
export const TAL_MAX = [5, 3, 3, 2, 1, 5, 3, 3, 2, 1, 3, 3, 3, 2, 1];
export const TREE_NAME = ['BLADE', 'GUARD', 'BERSERK', 'FIRE', 'FROST', 'ARCANE', 'MARKSMAN', 'BEASTS', 'SURVIVAL'];
export const TREE_COLOR = ['#ff5a4a', '#5aa8ff', '#ffb02e', '#ff7a2a', '#7fd8ff', '#c27cff', '#ffd25a', '#ff9a4a', '#6fe36a'];
export const TAL_NAME = [
  'MIGHT', 'KEEN EDGE', 'BLOODLUST', 'GIANT SLAYER', 'EXECUTE',
  'TOUGHNESS', 'IRON SKIN', 'DEFLECT', 'SECOND WIND', 'LAST STAND',
  'FLEET FOOT', 'CHARGE', 'RAGE', 'BLOODBATH', 'WHIRLWIND',
  'FIRE POWER', 'COMBUSTION', 'IGNITE', 'FLAME WAVE', 'METEOR',
  'ICE ARMOR', 'CHILL', 'SHATTER', 'FROST NOVA', 'ICE BLOCK',
  'QUICK CAST', 'QUICK BLINK', 'ARCANE MIND', 'ALCHEMY', 'TWIN BOLTS',
  'SHARP ARROWS', 'AIMED SHOT', 'PIERCING', 'LONG SHOT', 'MULTI-SHOT',
  'PET VITALITY', 'FEROCITY', 'MEND PET', 'KINDRED', 'BESTIAL WRATH',
  'FLEET FOOT', 'BEAST WHISPER', 'TREASURE HUNTER', 'CAMOUFLAGE', 'SCAVENGER'];
export const TAL_DESC = [
  '+2 attack per rank', '+6% critical hit per rank', '20% a rank: heal 1 HP on hit',
  '+25% boss damage per rank', '15% chance to slay a foe outright',
  '+5 max HP per rank', '+2 defense per rank', '+8% block chance per rank',
  'Slowly regain health', 'Live on 1 HP once per room',
  'Move faster (stacks with boots)', 'Your roll hits monsters', '+10% damage a rank under half HP',
  'Every kill heals 3 HP a rank', 'Your swing hits all around you',
  '+2 attack per rank', '+6% critical hit per rank', '25% a rank: set foes ablaze',
  'Bolts pierce 1 foe per rank', 'Every 4th bolt explodes',
  '+1 defense per rank', '28% a rank: slow a foe', '+25% a rank against slowed foes',
  'Blink freezes foes nearby', 'Cheat death once per room',
  'Cast bolts faster', '-15% blink cooldown per rank', 'Slowly regain health',
  'Potions heal +25% per rank', 'Cast two bolts at once',
  '+2 attack per rank', '+6% critical hit per rank', 'Arrows pierce 1 foe per rank',
  '+15% damage and range per rank', 'Shoot 3 arrows at once',
  '+20% pet HP per rank', '+20% pet damage per rank', 'Your pet heals over time',
  '25% a rank: pet bites heal you', 'Your pet bites twice as fast',
  'Move faster (stacks with boots)', 'Wider taming target per rank', '+20% gold per rank',
  '+10% dodge per rank', 'More potions from kills'];

// bosses
export const BOSS_ROLE = ['BRUTE', 'SHAMAN', 'WARDEN'];
export const BS_WALK = 0, BS_WIND = 1, BS_CHARGE = 2, BS_STUN = 3, BS_CAST = 4, BS_LEAP = 5;
export const BF_WIZ = 0, BF_RUN = 1, BF_DRINK = 2, BF_BRUTE = 3, BF_TF = 4;
export const KING_WIZ_HP = 6000, KING_BRUTE_HP = 12000, ALCH_X = 11;
export const MV_CHARGE = 0, MV_BURST = 1, MV_SUMMON = 2, MV_SLAM = 3, MV_SPIRAL = 4, MV_FAN = 5, MV_LEAP = 6, MV_BLINK = 7, MV_WARD = 8;
export const MV_NAME = ['CHARGE', 'BURST', 'SUMMON', 'SLAM', 'SPIRAL', 'FAN', 'LEAP', 'BLINK', 'WARD'];
export const BOSS_MOVES = [
  MV_CHARGE, MV_SLAM, MV_LEAP, MV_BURST, MV_SPIRAL, MV_BLINK, MV_SUMMON, MV_FAN, MV_WARD,
  MV_CHARGE, MV_SLAM, MV_LEAP, MV_SUMMON, MV_FAN, MV_BURST, MV_SPIRAL, MV_LEAP, MV_BLINK,
  MV_FAN, MV_BURST, MV_SPIRAL, MV_BLINK];
export const DIR16_X = [2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1, 0, 1, 2, 2];
export const DIR16_Y = [0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2, -1];
export const KING_SAYS = ['BEHOLD MY TRUE FORM!', 'GUARDS! TO ME!', 'ENOUGH! I WILL END YOU!'];
// room 5's three boss doors in the top wall (columns): easy, medium, hard
export const BDOOR_EASY = 2, BDOOR_MED = 7, BDOOR_HARD = 13;
export const DW_RIGHT = 0, DW_TOP = 1, DW_BOTTOM = 2;

export const PET_NAME = ['', 'SLIME', 'BAT', '', 'SPIDER'];
export const PET_RATE = [0, 32, 16, 0, 24];
export const TAME_ZONE = 16;

// messages are colored by kind
export const COL_WHITE = '#f6eee2', COL_GOLD = '#ffc93c', COL_RED = '#ff6a55';
