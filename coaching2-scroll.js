(() => {
  const section = document.querySelector('.coaching2-sequence');
  const stage = section?.querySelector('.coaching2-stage');
  const nextSection = document.querySelector('#coaching-packages');
  const items = [...(section?.querySelectorAll('[data-coaching-step]') || [])];
  if (!stage || items.length !== 3) return;

  const triggers = items.map(item => item.querySelector('.coaching2-trigger'));
  const panels = items.map(item => item.querySelector('.coaching2-panel'));
  const contents = items.map(item => item.querySelector('.coaching2-step-content'));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 900px), ((pointer: coarse) and (hover: none) and (orientation: portrait))');
  const ease = getComputedStyle(section).getPropertyValue('--ease').trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';
  const last = items.length - 1;
  let current = 0;
  let requested = 0;
  let running = false;
  let generation = 0;
  let animation = null;
  let readyAt = 0;
  let top = 0;
  let travel = 1;
  let previousY = window.scrollY;
  let frame = 0;
  let bypassUntil = 0;

  let isPinned = false;
  const pinned = () => isPinned;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const measure = () => {
    top = section.getBoundingClientRect().top + window.scrollY;
    travel = Math.max(1, section.offsetHeight - stage.getBoundingClientRect().height);
  };
  const anchor = index => top + travel * [0.002, 0.5, 0.9][index];
  const scrollToAnchor = index => {
    const y = anchor(index);
    if (typeof window.siteScrollTo === 'function') window.siteScrollTo(y);
    else window.scrollTo({ top: y, behavior: 'smooth' });
  };
  const select = index => {
    const changed = current !== index;
    current = index;
    items.forEach((item, i) => {
      const active = i === index;
      item.classList.toggle('is-active', active);
      triggers[i].setAttribute('aria-expanded', String(active));
      panels[i].setAttribute('aria-hidden', String(!active));
      panels[i].toggleAttribute('inert', !active);
    });
    if (changed) panels[index].scrollTop = 0;
  };
  const settle = index => {
    generation++;
    animation?.cancel();
    animation = null;
    running = false;
    requested = index;
    select(index);
    readyAt = 0;
  };
  const wipe = async (element, entering, direction) => {
    const hidden = direction > 0 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)';
    const playing = element.animate(
      entering
        ? [{ clipPath: hidden, opacity: 0 }, { clipPath: 'inset(0)', opacity: 1 }]
        : [{ clipPath: 'inset(0)', opacity: 1 }, { clipPath: hidden, opacity: 0 }],
      { duration: entering ? 760 : 350, easing: ease, fill: 'both' }
    );
    animation = playing;
    await playing.finished.catch(() => {});
    playing.cancel();
    if (animation === playing) animation = null;
  };
  const transition = async () => {
    if (running || current === requested) return;
    if (motion.matches) {
      select(requested);
      return;
    }
    running = true;
    const token = generation;
    while (current !== requested && token === generation) {
      const direction = Math.sign(requested - current);
      await wipe(contents[current], false, direction);
      if (token !== generation) return;
      select(requested);
      await wipe(contents[current], true, direction);
      if (token !== generation) return;
    }
    running = false;
    readyAt = performance.now() + 420;
  };
  const open = (index, movePage = true) => {
    requested = index;
    void transition();
    if (movePage && pinned()) scrollToAnchor(index);
  };
  const inside = () => pinned() && window.scrollY >= top - 2 && window.scrollY <= top + travel + 2;
  const scrollablePanel = direction => {
    const panel = panels[current];
    if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return null;
    const remaining = direction > 0
      ? panel.scrollHeight - panel.clientHeight - panel.scrollTop : panel.scrollTop;
    return remaining > 1 ? panel : null;
  };
  const advance = direction => {
    if (running || performance.now() < readyAt) return true;
    const next = current + direction;
    if (next < 0 || next > last) return false;
    open(next);
    return true;
  };
  const leave = direction => {
    bypassUntil = performance.now() + 1800;
    const target = direction > 0 && nextSection
      ? nextSection.getBoundingClientRect().top + window.scrollY
      : Math.max(0, top - window.innerHeight);
    if (typeof window.siteScrollTo === 'function') window.siteScrollTo(target);
    else window.scrollTo({ top: target, behavior: 'smooth' });
  };

  // The entry snap changes only the scroll target. CSS sticky owns the stage;
  // this controller alone owns which accordion panel is open.
  const update = () => {
    frame = 0;
    const y = window.scrollY;
    if (!pinned() || performance.now() < bypassUntil) {
      previousY = y;
      return;
    }
    if (previousY < top && y >= top && y <= top + travel) {
      settle(0);
      scrollToAnchor(0);
    } else if (previousY > top + travel && y <= top + travel && y >= top) {
      settle(last);
      scrollToAnchor(last);
    } else if (previousY < top && y > top + travel) {
      settle(0);
      scrollToAnchor(0);
    } else if (y > top + travel && (current < last || running) && previousY <= top + travel) {
      scrollToAnchor(current);
    } else if (y < top && (current > 0 || running) && previousY >= top) {
      scrollToAnchor(current);
    }
    previousY = y;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const reset = () => {
    isPinned = !motion.matches && !compact.matches;
    section.classList.toggle('is-pinned', isPinned);
    measure();
    const index = window.scrollY < top ? 0 : !isPinned ? current
      : window.scrollY > top + travel ? last
      : clamp(Math.round((window.scrollY - top) / travel * last), 0, last);
    settle(index);
    previousY = window.scrollY;
  };

  triggers.forEach((trigger, index) => trigger.addEventListener('click', () => {
    measure();
    open(index);
  }));
  document.querySelectorAll('a[href="#coaching2-story"]').forEach(link => link.addEventListener('click', event => {
    if (!pinned()) return;
    event.preventDefault();
    event.stopPropagation();
    measure();
    bypassUntil = performance.now() + 1800;
    settle(0);
    scrollToAnchor(0);
  }));
  document.addEventListener('click', event => {
    if (event.target.closest('a[data-coaching-nav]:not([href="#coaching2-story"])')) {
      bypassUntil = performance.now() + 2400;
    }
  }, { capture: true });
  window.addEventListener('wheel', event => {
    if (event.ctrlKey || !event.deltaY || !pinned()) return;
    const direction = Math.sign(event.deltaY);
    if (inside()) {
      const panel = scrollablePanel(direction);
      if (panel) {
        panel.scrollTop += event.deltaY;
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (advance(direction)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else {
        leave(direction);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } else if (direction > 0 && window.scrollY >= top - window.innerHeight * 0.28 && window.scrollY < top) {
      settle(0);
      scrollToAnchor(0);
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (direction < 0 && window.scrollY <= top + section.offsetHeight + window.innerHeight * 0.28 && window.scrollY > top + travel) {
      settle(last);
      scrollToAnchor(last);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true, passive: false });
  let touchStart = null;
  window.addEventListener('touchstart', event => {
    touchStart = inside() && event.touches.length === 1
      ? { y: event.touches[0].clientY, target: event.target } : null;
  }, { capture: true, passive: true });
  window.addEventListener('touchmove', event => {
    if (!touchStart || !event.touches.length) return;
    const direction = Math.sign(touchStart.y - event.touches[0].clientY);
    if (!direction || scrollablePanel(direction)) return;
    event.preventDefault();
  }, { capture: true, passive: false });
  window.addEventListener('touchend', event => {
    if (!touchStart) return;
    const distance = touchStart.y - (event.changedTouches[0]?.clientY ?? touchStart.y);
    if (Math.abs(distance) > 35 && !scrollablePanel(Math.sign(distance))) {
      if (!advance(Math.sign(distance))) leave(Math.sign(distance));
    }
    touchStart = null;
  }, { capture: true });
  window.addEventListener('touchcancel', () => { touchStart = null; }, { capture: true });
  window.addEventListener('keydown', event => {
    if (!inside() || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = ['ArrowDown', 'PageDown', ' ', 'End'].includes(event.key) ? 1
      : ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ? -1 : 0;
    if (direction) {
      const panel = scrollablePanel(direction);
      if (panel) panel.scrollTop += direction * Math.max(160, panel.clientHeight * 0.8);
      else if (!advance(direction)) leave(direction);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', reset, { passive: true });
  window.addEventListener('pageshow', reset, { passive: true });
  document.fonts?.ready?.then(reset);
  motion.addEventListener('change', reset);
  compact.addEventListener('change', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settle(current);
  });
  reset();
})();
