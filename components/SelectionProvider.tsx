"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { defaultSelections, sanitizeAppName } from "@/lib/assemble";
import type { WizardSelections } from "@/lib/types";

interface SelectionCtx {
  sel: WizardSelections;
  setSel: React.Dispatch<React.SetStateAction<WizardSelections>>;
  /** Sanitized scaffold folder for the current selections. */
  dir: string;
}

const Ctx = createContext<SelectionCtx | null>(null);

// Single owner of the wizard selections so every section (hero preview,
// guide, FAQ, wizard output) reads the same live values.
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [sel, setSel] = useState<WizardSelections>(() => defaultSelections());
  const dir = useMemo(() => sanitizeAppName(sel.appName, sel), [sel]);
  const value = useMemo(() => ({ sel, setSel, dir }), [sel, dir]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelection(): SelectionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelection must be used inside <SelectionProvider>");
  return v;
}
