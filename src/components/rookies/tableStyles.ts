// Shared cell classes for the Rookies page tables: the player-name column stays
// pinned to the left edge while the rest of a wide table scrolls horizontally
// (needed at phone widths). Both need an opaque background so scrolled-under
// columns don't show through; `group-hover` keeps the row hover highlight
// consistent since the sticky cell can't rely on the row's own translucent bg.
export const STICKY_TH = 'sticky left-0 z-10 bg-slate-900'
export const STICKY_TD = 'sticky left-0 z-10 bg-[#0f1117] group-hover:bg-[#171b26]'
