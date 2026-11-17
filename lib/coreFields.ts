import type { FieldDef, FormSchema } from "./api";

/**
 * Lets hard-coded case forms follow Form Builder for the built-in ("core") fields: an admin can hide a field,
 * rename it, or change a dropdown's options, and the form reflects it. Fields the schema doesn't mention are
 * shown with the form's own label and options, so nothing disappears when the schema hasn't loaded yet.
 */
export function coreFields(schema: FormSchema | null) {
  const byKey = new Map<string, FieldDef>();
  for (const section of schema?.sections ?? []) {
    for (const f of section.fields) if (f.isCore) byKey.set(f.key, f);
  }
  return {
    /** False only when Form Builder has explicitly hidden this field. */
    show: (key: string): boolean => byKey.get(key)?.isActive !== false,
    label: (key: string, fallback: string): string => byKey.get(key)?.label?.trim() || fallback,
    /** Form Builder's option list when it has one, otherwise the form's built-in list. */
    options: (key: string, fallback: readonly string[]): readonly string[] => {
      const o = byKey.get(key)?.options;
      return o && o.length > 0 ? o : fallback;
    },
    /** Form Builder's "required" flag, or the form's own default. */
    required: (key: string, fallback = false): boolean => byKey.get(key)?.required ?? fallback,
  };
}
