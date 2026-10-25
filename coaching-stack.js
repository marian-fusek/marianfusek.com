(() => {
  const cards = [...document.querySelectorAll('.coaching-stack-card')];
  if (!cards.length) return;

  // Tall cards move only far enough to reveal their final line.
  const measure = () => {
    for (const card of cards) {
      const overflow = Math.max(0, Math.ceil(card.getBoundingClientRect().height - window.innerHeight));
      card.style.setProperty('--card-overflow', `${overflow}px`);
    }
  };

  let frame = 0;
  const updateOverlap = () => {
    frame = 0;
    const sticky = getComputedStyle(cards[0]).position === 'sticky';
    cards.forEach((card, index) => {
      const content = card.querySelector('.coaching-stack-inner');
      if (!content) return;
      if (!sticky || index === cards.length - 1) {
        content.style.opacity = '1';
        return;
      }
      const nextTop = cards[index + 1].getBoundingClientRect().top;
      const covered = Math.max(0, Math.min(1, (window.innerHeight - nextTop) / (window.innerHeight * 0.5)));
      content.style.opacity = String(1 - covered);
    });
  };
  const scheduleOverlap = () => {
    if (!frame) frame = requestAnimationFrame(updateOverlap);
  };

  const observer = new ResizeObserver(measure);
  cards.forEach(card => observer.observe(card));
  window.addEventListener('resize', () => { measure(); scheduleOverlap(); }, { passive: true });
  window.addEventListener('scroll', scheduleOverlap, { passive: true });
  document.fonts?.ready.then(() => { measure(); scheduleOverlap(); });
  measure();
  updateOverlap();
})();
