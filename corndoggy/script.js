const hero = document.querySelector('.hero');

if (hero && hero.querySelector('.doodle-card')) {
  const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const resetPointer = () => {
    targetX = 0;
    targetY = 0;
  };

  const updatePointer = (event) => {
    const bounds = hero.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    targetX = ((event.clientX - centerX) / bounds.width) * 44;
    targetY = ((event.clientY - centerY) / bounds.height) * 34;
  };

  const animatePointer = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    hero.style.setProperty('--pointer-x', `${currentX}px`);
    hero.style.setProperty('--pointer-y', `${currentY}px`);
    window.requestAnimationFrame(animatePointer);
  };

  if (supportsFinePointer) {
    hero.addEventListener('pointermove', updatePointer);
    hero.addEventListener('pointerleave', resetPointer);
    window.requestAnimationFrame(animatePointer);
  }
}
