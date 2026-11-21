/** True when the shortcut that opens the palette was pressed: ⌘K on a Mac, Ctrl+K elsewhere. */
export const isPaletteShortcut = (e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>): boolean => e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
