/**
 * Copy `text`, and report whether it actually landed.
 *
 * The helper this replaces (duplicated in Wizard.tsx and Guide.tsx) swallowed
 * every failure and still showed "Copied ✓" — over http:, inside a sandboxed
 * iframe, or when the user denies the permission, nothing reached the
 * clipboard. Both callers now branch on the returned boolean.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied or insecure context — fall through to the execCommand path.
    }
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  // Off-screen but still selectable — display:none would break select().
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "-9999px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    ta.remove();
  }
  return ok;
}
