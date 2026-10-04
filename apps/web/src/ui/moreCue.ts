/** Marks a scrolling column with "more" while there's content below the fold (a soft fade at its foot). */
export function moreCue(el: HTMLElement | null) {
  if (!el || el.dataset.cue) return;
  el.dataset.cue = "1";
  const update = () => el.classList.toggle("more", el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  el.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(el);
  new MutationObserver(update).observe(el, { childList: true, subtree: true });
  update();
}
