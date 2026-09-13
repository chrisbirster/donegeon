import { expect, type Page } from "@playwright/test";

export async function expectNoCriticalAccessibilityIssues(page: Page, context: string) {
  const violations = await page.evaluate(() => {
    const issues: string[] = [];
    const visible = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return element.getClientRects().length > 0;
    };
    const textFromIds = (value: string | null) => {
      if (!value) return "";
      return value
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
    };
    const accessibleName = (element: Element) => {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = textFromIds(element.getAttribute("aria-labelledby"));
      if (labelledBy) return labelledBy;
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        const labels = Array.from(element.labels ?? []).map((label) => label.textContent?.trim() ?? "").filter(Boolean);
        if (labels.length) return labels.join(" ");
        const placeholder = element.getAttribute("placeholder")?.trim();
        if (placeholder) return placeholder;
      }
      const title = element.getAttribute("title")?.trim();
      if (title) return title;
      return element.textContent?.trim() ?? "";
    };

    const ids = new Map<string, number>();
    for (const element of document.querySelectorAll<HTMLElement>("[id]")) {
      const id = element.id.trim();
      if (!id) continue;
      ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
      if (count > 1) issues.push(`duplicate id #${id} appears ${count} times`);
    }

    const namedSelectors = [
      "button",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[role='button']",
      "[role='combobox']",
      "[role='menuitem']",
    ].join(",");
    for (const element of document.querySelectorAll(namedSelectors)) {
      if (!visible(element) || element.getAttribute("aria-hidden") === "true") continue;
      if (!accessibleName(element)) {
        issues.push(`${element.tagName.toLowerCase()}${element.getAttribute("role") ? `[role=${element.getAttribute("role")}]` : ""} has no accessible name`);
      }
    }

    for (const dialog of document.querySelectorAll("[role='dialog']")) {
      if (!visible(dialog)) continue;
      if (!accessibleName(dialog)) issues.push("visible dialog has no accessible name");
      if (dialog.getAttribute("aria-modal") !== "true") issues.push(`dialog "${accessibleName(dialog)}" is missing aria-modal=true`);
    }

    for (const combobox of document.querySelectorAll("[role='combobox']")) {
      if (!visible(combobox)) continue;
      const expanded = combobox.getAttribute("aria-expanded");
      if (expanded !== "true" && expanded !== "false") {
        issues.push(`combobox "${accessibleName(combobox)}" must expose aria-expanded=true/false`);
      }
      const controls = combobox.getAttribute("aria-controls")?.trim();
      if (!controls) {
        issues.push(`combobox "${accessibleName(combobox)}" is missing aria-controls`);
      } else if (expanded === "true" && !document.getElementById(controls)) {
        issues.push(`expanded combobox "${accessibleName(combobox)}" controls missing #${controls}`);
      }
    }

    for (const listbox of document.querySelectorAll("[role='listbox']")) {
      if (!visible(listbox)) continue;
      if (!accessibleName(listbox)) issues.push("visible listbox has no accessible name");
      for (const option of listbox.querySelectorAll("[role='option']")) {
        if (!accessibleName(option)) issues.push("visible listbox option has no accessible name");
        const selected = option.getAttribute("aria-selected");
        if (selected !== "true" && selected !== "false") {
          issues.push(`option "${accessibleName(option)}" must expose aria-selected=true/false`);
        }
      }
    }

    for (const menu of document.querySelectorAll("[role='menu']")) {
      if (!visible(menu)) continue;
      const items = menu.querySelectorAll("[role='menuitem']");
      if (items.length === 0) issues.push("visible menu has no menuitems");
      for (const item of items) {
        if (!accessibleName(item)) issues.push("visible menuitem has no accessible name");
      }
    }

    for (const described of document.querySelectorAll("[aria-describedby]")) {
      const ids = described.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ?? [];
      for (const id of ids) {
        if (!document.getElementById(id)) issues.push(`${described.tagName.toLowerCase()} references missing aria-describedby #${id}`);
      }
    }

    return issues;
  });

  expect(violations, `${context}: critical accessibility structure should be clean`).toEqual([]);
}
