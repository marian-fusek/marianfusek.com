import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import FluidGlass from './components/FluidGlass.jsx';

function wrapCopy(value, width, fontFamily, fontWeight, fontSize) {
  const measureCanvas = document.createElement('canvas');
  const context = measureCanvas.getContext('2d');
  if (!context) return value;
  const availableWidth = Math.max(width, fontSize * 4);
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const lines = [];
  let line = '';

  value.trim().split(/\s+/).forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > availableWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.join('\n');
}

function prepareTitleLines(copy) {
  const source = copy.dataset.fluidGlassSourceText || copy.textContent.trim();
  copy.dataset.fluidGlassSourceText = source;
  const style = getComputedStyle(copy.parentElement);
  const lines = wrapCopy(source, copy.getBoundingClientRect().width, style.fontFamily, style.fontWeight, Number.parseFloat(style.fontSize)).split('\n');
  const alreadyRevealed = copy.classList.contains('is-revealed');
  copy.replaceChildren(...lines.map((text, index) => {
    const line = document.createElement('span');
    line.className = 'coaching-fluid-glass-line';
    line.dataset.fluidGlassLine = '';
    line.style.setProperty('--fluid-glass-line-index', index);
    line.textContent = `${text}${index < lines.length - 1 ? ' ' : ''}`;
    return line;
  }));
  copy.classList.toggle('is-revealed', alreadyRevealed);
  if (!copy.dataset.fluidGlassRevealListener) {
    copy.dataset.fluidGlassRevealListener = 'true';
    copy.addEventListener('animationend', event => {
      if (event.animationName !== 'coaching-title-line-wipe') return;
      const finished = copy.querySelectorAll('.coaching-fluid-glass-line.is-wiped').length + 1;
      event.target.classList.add('is-wiped');
      if (finished >= copy.querySelectorAll('.coaching-fluid-glass-line').length) copy.classList.add('is-revealed');
    });
  }
}

function readClipRect(element) {
  const rect = element.getBoundingClientRect();
  const inset = getComputedStyle(element).clipPath.match(/inset\(([^)]+)\)/)?.[1];
  if (!inset) return rect;
  const values = inset.split(/\s+/);
  const [top, right = top, bottom = top, left = right] = values.map(value => {
    const amount = Number.parseFloat(value) || 0;
    return value.endsWith('%') ? amount / 100 : amount;
  });
  const offset = (value, token, extent) => token.endsWith('%') ? value * extent : value;
  const topInset = offset(top, values[0], rect.height);
  const rightInset = offset(right, values[1] ?? values[0], rect.width);
  const bottomInset = offset(bottom, values[2] ?? values[0], rect.height);
  const leftInset = offset(left, values[3] ?? values[1] ?? values[0], rect.width);
  return {
    left: rect.left + leftInset,
    top: rect.top + topInset,
    right: rect.right - rightInset,
    bottom: rect.bottom - bottomInset
  };
}

function measureTextLayers(copies) {
  return copies.flatMap(copy => {
    const copyRect = copy.getBoundingClientRect();
    const style = getComputedStyle(copy.parentElement);
    const fontSize = Number.parseFloat(style.fontSize);
    const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.1;
    const sourceLines = [...copy.querySelectorAll('.coaching-fluid-glass-line')].map(element => ({
      element,
      text: element.textContent.trim(),
      x: copyRect.left,
      y: element.getBoundingClientRect().top,
      width: copyRect.width
    }));

    return sourceLines.map(({ element, text, x, y, width }) => {
      const rect = element.getBoundingClientRect();

      let opacity = 1;
      let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        opacity *= Number.parseFloat(getComputedStyle(ancestor).opacity) || 0;
        const next = readClipRect(ancestor);
        clip = {
          left: Math.max(clip.left, next.left),
          top: Math.max(clip.top, next.top),
          right: Math.min(clip.right, next.right),
          bottom: Math.min(clip.bottom, next.bottom)
        };
      }

      return {
        text,
        x,
        y,
        width,
        height: Math.max(rect.height, lineHeight),
        clip,
        opacity,
        color: style.color,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize,
        lineHeight,
        letterSpacing: style.letterSpacing
      };
    });
  });
}

function useStageActive(stage) {
  const [active, setActive] = useState(() => stage.dataset.active !== 'false');

  useEffect(() => {
    const observer = new MutationObserver(() => setActive(stage.dataset.active !== 'false'));
    observer.observe(stage, { attributes: true, attributeFilter: ['data-active'] });
    return () => observer.disconnect();
  }, [stage]);

  return active;
}

function useTextLayers(copies, active) {
  const [layers, setLayers] = useState(() => measureTextLayers(copies));

  useEffect(() => {
    if (!active) return undefined;
    const MIN_TEXT_LAYER_INTERVAL = 1000 / 30;
    let frame = 0;
    let introFrame = 0;
    let measureTimer = 0;
    let lastMeasuredAt = 0;
    const measure = timestamp => {
      frame = 0;
      const remaining = MIN_TEXT_LAYER_INTERVAL - (timestamp - lastMeasuredAt);
      if (lastMeasuredAt && remaining > 0) {
        measureTimer = window.setTimeout(() => {
          measureTimer = 0;
          schedule();
        }, remaining);
        return;
      }
      lastMeasuredAt = timestamp;
      const next = measureTextLayers(copies);
      setLayers(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => {
      if (!frame && !measureTimer) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    copies.forEach(copy => {
      observer.observe(copy);
      if (copy.parentElement) observer.observe(copy.parentElement);
    });
    const titleCopies = copies.filter(copy => copy.dataset.fluidGlassCopy === 'title');
    const relayoutTitleLines = () => {
      titleCopies.forEach(prepareTitleLines);
      schedule();
    };
    const updateIntro = () => {
      introFrame = 0;
      schedule();
      const stillAnimating = titleCopies.some(copy =>
        [...copy.querySelectorAll('.coaching-fluid-glass-line')].some(line =>
          line.getAnimations().some(animation => animation.playState !== 'finished')
        )
      );
      if (stillAnimating) introFrame = window.setTimeout(updateIntro, MIN_TEXT_LAYER_INTERVAL);
    };
    const startIntroTracking = () => {
      if (!introFrame) updateIntro();
    };
    titleCopies.forEach(copy => copy.addEventListener('animationstart', startIntroTracking));
    titleCopies.forEach(copy => copy.addEventListener('animationend', schedule));
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', relayoutTitleLines, { passive: true });
    document.fonts?.ready.then(relayoutTitleLines);
    schedule();
    relayoutTitleLines();
    startIntroTracking();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(introFrame);
      clearTimeout(measureTimer);
      observer.disconnect();
      titleCopies.forEach(copy => copy.removeEventListener('animationstart', startIntroTracking));
      titleCopies.forEach(copy => copy.removeEventListener('animationend', schedule));
      removeEventListener('scroll', schedule);
      removeEventListener('resize', relayoutTitleLines);
    };
  }, [copies, active]);

  return layers;
}

function CoachingFluidGlass({ copies, stage }) {
  const active = useStageActive(stage);
  const textLayers = useTextLayers(copies, active);

  return (
    <FluidGlass
      active={active}
      text=""
      textLayers={textLayers}
      background="#f7f5f2"
      shape="prism"
      size={260}
      renderFootprintOnly
      refraction={1}
      dispersion={0.35}
      color="#aebfb4"
      tint={0.24}
      reflection={1.6}
      shadow={0}
      interaction="follow"
      idle={false}
      morphOnClick={false}
      intro={false}
      className="coaching-fluid-glass--shared"
    />
  );
}

function mountFluidGlassStage() {
  const stage = document.querySelector('[data-fluid-glass-stage]');
  const mountTarget = stage?.querySelector('[data-fluid-glass-mount]');
  const copies = [...document.querySelectorAll('[data-fluid-glass-copy]')];
  if (!stage || !mountTarget || copies.length !== 1 || copies[0].dataset.fluidGlassCopy !== 'title') return;
  createRoot(mountTarget).render(<CoachingFluidGlass copies={copies} stage={stage} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountFluidGlassStage, { once: true });
} else {
  mountFluidGlassStage();
}
