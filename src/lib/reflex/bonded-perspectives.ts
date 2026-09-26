export type BondedPerspective = {
  hwnd: number;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  bondedAt: string;
};

const LEGACY_STORAGE_KEY = "dins-first-sight-bond-history";

export function bondedPerspectiveKey(item: Pick<BondedPerspective, "hwnd" | "title">): string {
  return `${item.hwnd}::${item.title}`;
}

export function loadBondedPerspectives(): BondedPerspective[] {
  // Session-only by design. Remove persistence introduced by the abandoned dropdown branch.
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage availability is irrelevant to session bonding.
  }
  return [];
}

export function rememberBondedPerspective(
  previous: BondedPerspective[],
  item: BondedPerspective,
): BondedPerspective[] {
  // Keep every distinct HWND bonded during this page session.
  // Rebonding the same HWND refreshes that entry instead of duplicating it.
  return [item, ...previous.filter((old) => old.hwnd !== item.hwnd)].slice(0, 64);
}

export function mountBondedPerspectiveSelector(options: {
  items: BondedPerspective[];
  activeKey: string;
  enabled: boolean;
  physicalScreenValue: string;
  onSelect: (item: BondedPerspective) => void | Promise<void>;
}): () => void {
  const toolbar = document.querySelector<HTMLElement>("#screen-map-panel .screen-map-toolbar");
  if (!toolbar) return () => undefined;

  // Keep the physical-screen selector. Remove only its misleading "Choose screen"
  // placeholder from normal use, and keep it pointed at the real selected monitor
  // while nativeBounds temporarily represents a bonded window.
  const physicalScreenSelect =
    toolbar.querySelector<HTMLSelectElement>('select[aria-label="Choose screen"]');

  if (physicalScreenSelect) {
    physicalScreenSelect.hidden = false;

    const placeholder = Array.from(physicalScreenSelect.options).find(
      (option) => option.value === "",
    );
    if (placeholder) {
      placeholder.disabled = true;
      placeholder.hidden = true;
    }

    if (
      options.physicalScreenValue &&
      Array.from(physicalScreenSelect.options).some(
        (option) => option.value === options.physicalScreenValue,
      )
    ) {
      physicalScreenSelect.value = options.physicalScreenValue;
    }
  }

  toolbar.querySelector("[data-dins-bonded-perspectives]")?.remove();

  // One selector for windows actually bonded during THIS session.
  const select = document.createElement("select");
  select.dataset.dinsBondedPerspectives = "true";
  select.className = "h-8 max-w-80 rounded-md border border-border bg-background px-2 text-sm";
  select.setAttribute("aria-label", "Session bonded windows");

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.hidden = options.items.length > 0;
  placeholder.textContent =
    options.items.length > 0 ? "Select bonded window" : "No bonded windows yet";
  select.appendChild(placeholder);

  for (const item of options.items) {
    const option = document.createElement("option");
    const key = bondedPerspectiveKey(item);
    option.value = key;
    option.textContent =
      `${key === options.activeKey ? "ACTIVE: " : ""}${item.title}`;
    select.appendChild(option);
  }

  const activeExists =
    options.activeKey.length > 0 &&
    options.items.some(
      (item) => bondedPerspectiveKey(item) === options.activeKey,
    );

  select.value = activeExists ? options.activeKey : "";
  select.disabled = !options.enabled || options.items.length === 0;

  const onChange = () => {
    const selected = options.items.find(
      (item) => bondedPerspectiveKey(item) === select.value,
    );
    if (selected) void options.onSelect(selected);
  };
  select.addEventListener("change", onChange);

  const bondButton = Array.from(toolbar.querySelectorAll("button")).find(
    (button) =>
      /^(re)?bond window$/i.test((button.textContent || "").trim()),
  );

  if (bondButton) toolbar.insertBefore(select, bondButton);
  else toolbar.appendChild(select);

  return () => {
    select.removeEventListener("change", onChange);
    select.remove();
  };
}
