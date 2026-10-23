/**
 * Spanish labels for the exercise catalog's English muscle / equipment / body
 * part values (Gym visual dataset). Unknown values fall back to the original.
 * Pure: safe in server and client components.
 */
const MUSCLES: Record<string, string> = {
  abductors: "Abductores",
  abs: "Abdomen",
  adductors: "Aductores",
  ankles: "Tobillos",
  "ankle stabilizers": "Estabilizadores del tobillo",
  biceps: "Bíceps",
  calves: "Pantorrillas",
  chest: "Pecho",
  core: "Core",
  deltoids: "Deltoides",
  delts: "Deltoides",
  forearms: "Antebrazos",
  glutes: "Glúteos",
  hamstrings: "Isquiotibiales",
  "hip flexors": "Flexores de cadera",
  lats: "Dorsales",
  "latissimus dorsi": "Dorsal ancho",
  "lower back": "Espalda baja",
  obliques: "Oblicuos",
  pectorals: "Pectorales",
  quads: "Cuádriceps",
  quadriceps: "Cuádriceps",
  "rear deltoids": "Deltoides posterior",
  rhomboids: "Romboides",
  shoulders: "Hombros",
  soleus: "Sóleo",
  trapezius: "Trapecio",
  traps: "Trapecio",
  triceps: "Tríceps",
  "upper back": "Espalda alta",
  "upper chest": "Pecho superior",
  neck: "Cuello",
};

const EQUIPMENT: Record<string, string> = {
  band: "Liga",
  barbell: "Barra",
  "body weight": "Peso corporal",
  cable: "Polea",
  dumbbell: "Mancuernas",
  "ez barbell": "Barra Z",
  "leverage machine": "Máquina",
  "sled machine": "Máquina de trineo",
  "smith machine": "Máquina Smith",
  weighted: "Con lastre",
  kettlebell: "Pesa rusa",
};

const BODY_PARTS: Record<string, string> = {
  back: "Espalda",
  chest: "Pecho",
  "lower legs": "Piernas (pantorrilla)",
  shoulders: "Hombros",
  "upper arms": "Brazos",
  "upper legs": "Piernas",
  waist: "Cintura",
  "lower arms": "Antebrazos",
  neck: "Cuello",
  cardio: "Cardio",
};

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function lookup(map: Record<string, string>, value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return map[v.toLowerCase()] ?? capitalize(v);
}

export const muscleEs = (v: string | null | undefined) => lookup(MUSCLES, v);
export const equipmentEs = (v: string | null | undefined) => lookup(EQUIPMENT, v);
export const bodyPartEs = (v: string | null | undefined) => lookup(BODY_PARTS, v);

/** De-duplicated Spanish muscle labels (e.g. "traps" and "trapezius" → one "Trapecio"). */
export function musclesEs(values: readonly string[], exclude: readonly (string | null)[] = []): string[] {
  const out: string[] = [];
  const skip = new Set(exclude.filter(Boolean));
  for (const v of values) {
    const l = muscleEs(v);
    if (l && !skip.has(l) && !out.includes(l)) out.push(l);
  }
  return out;
}
