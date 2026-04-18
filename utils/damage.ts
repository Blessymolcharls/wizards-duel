import type { SpellId } from "./spellRegistry";

export type DamageModifiers = {
  comboMultiplier?: number;
  flatBonus?: number;
  reduction?: number;
};

const SPELL_DAMAGE_SCALARS: Readonly<Record<SpellId, number>> = {
  expelliarmus: 1,
  stupefy: 1,
  sectumsempra: 1,
  bombarda: 1,
  aguamenti: 1,
  protego: 1,
  protego_maxima: 1,
  lumos: 1,
  nox: 1,
  petrificus_totalus: 1,
};

const clampNonNegative = (value: number): number => Math.max(0, value);

export const calculateDamage = (
  spellId: SpellId,
  basePower: number,
  modifiers: DamageModifiers = {},
): number => {
  const scalar = SPELL_DAMAGE_SCALARS[spellId] ?? 1;
  const comboMultiplier = modifiers.comboMultiplier ?? 1;
  const flatBonus = modifiers.flatBonus ?? 0;
  const reduction = modifiers.reduction ?? 0;

  const scaled = basePower * scalar * comboMultiplier;
  const adjusted = scaled + flatBonus - reduction;
  return Math.round(clampNonNegative(adjusted));
};
