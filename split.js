document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.grid').forEach(grid => {
    const side = grid.querySelector('.side');
    if (!side) return;

    // mål startbredden før splitteren legges til slik at vi bevarer
    // sidens opprinnelige bredde på ulike sider
    const initialWidth = side.getBoundingClientRect().width;
    const splitter = document.createElement('div');
    splitter.className = 'splitter';
    grid.insertBefore(splitter, side);
    grid.classList.add('split-enabled');
    grid.style.setProperty('--side-width', `${initialWidth}px`);

    const computedStyle = getComputedStyle(grid);
    const baseSideMax = Number.parseFloat(
      computedStyle.getPropertyValue('--side-max')
    );
    const applySideMax = () => {
      const currentWidth = grid.clientWidth;
      if (!currentWidth) return;
      const desiredMax = Math.max(baseSideMax || 0, currentWidth * 0.5);
      grid.style.setProperty('--side-max', `${desiredMax}px`);
    };
    applySideMax();
    window.addEventListener('resize', applySideMax);
    let startX = 0;
    let startWidth = 0;
    const minWidth = 200;
    let scheduledResize = false;
    const scheduleResize = () => {
      if (scheduledResize) return;
      scheduledResize = true;
      requestAnimationFrame(() => {
        scheduledResize = false;
        window.dispatchEvent(new Event('resize'));
      });
    };

    let gridWidth = 0;
    let pendingWidth = null;
    let pendingFrame = null;
    const commitWidth = width => {
      grid.style.setProperty('--side-width', `${width}px`);
      scheduleResize();
    };
    const flushPendingWidth = () => {
      if (pendingWidth == null) return;
      const widthToApply = pendingWidth;
      pendingWidth = null;
      commitWidth(widthToApply);
    };
    const requestWidthUpdate = width => {
      pendingWidth = width;
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        flushPendingWidth();
      });
    };
    const onMove = e => {
      const dx = e.clientX - startX;
      let newWidth = startWidth + dx;
      const maxWidth = Math.max(minWidth, gridWidth - 100);
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      requestWidthUpdate(newWidth);
    };
    const stopDrag = e => {
      if (
        e &&
        typeof splitter.releasePointerCapture === 'function' &&
        typeof splitter.hasPointerCapture === 'function' &&
        splitter.hasPointerCapture(e.pointerId)
      ) {
        splitter.releasePointerCapture(e.pointerId);
      }
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', stopDrag);
      flushPendingWidth();
    };
    const startDrag = e => {
      e.preventDefault();
      applySideMax();
      startX = e.clientX;
      startWidth = side.getBoundingClientRect().width;
      gridWidth = grid.clientWidth;
      if (typeof splitter.setPointerCapture === 'function') {
        splitter.setPointerCapture(e.pointerId);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', stopDrag);
    };
    splitter.addEventListener('pointerdown', startDrag);
    splitter.addEventListener('lostpointercapture', stopDrag);
  });
});
