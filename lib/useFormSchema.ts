"use client";

import { useEffect, useState } from "react";
import { formSchemasApi, type FormSchema } from "./api";

// One in-flight/finished request per form id for this page load, so every component that needs the same
// schema (filter panel, detail view, forms) shares a single fetch instead of each calling the API.
const cache = new Map<string, Promise<FormSchema | null>>();

export function loadFormSchema(formId: string, fresh = false): Promise<FormSchema | null> {
  if (fresh || !cache.has(formId)) {
    cache.set(formId, formSchemasApi.get(formId).then((r) => r.data).catch(() => null));
  }
  return cache.get(formId)!;
}

/** A Form Builder schema (null until loaded or if it can't be fetched — callers then show everything). */
export function useFormSchema(formId: string): FormSchema | null {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  useEffect(() => {
    let alive = true;
    loadFormSchema(formId).then((s) => { if (alive) setSchema(s); });
    return () => { alive = false; };
  }, [formId]);
  return schema;
}
