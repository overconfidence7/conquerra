/** Marks a scrolling column with "more" while there's content below the fold (a soft fade at its foot). */
export function moreCue(el: HTMLElement | null) {
  if (!el || el.dataset.cue) return;
  el.dataset.cue = "1";
  // More than the frame's corner pieces, which hang 5 px over its foot (counting them faded out the last row for good).
  const update = () => el.classList.toggle("more", el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  el.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(el);
  new MutationObserver(update).observe(el, { childList: true, subtree: true });
  update();
}
