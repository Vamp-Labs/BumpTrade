import { animate } from 'motion';

export interface PopPunchOptions {
  scaleFrom?: number;
  scalePeak?: number;
  scaleTo?: number;
  rotateDeg?: number;
  duration?: number;
  yOffset?: number;
}

export interface SlideDownOptions {
  yFrom?: number;
  yPeak?: number;
  yTo?: number;
  scaleFrom?: number;
  scalePeak?: number;
  scaleTo?: number;
  duration?: number;
}

export class MotionFX {
  /**
   * Snappy arcade spring pop-punch with overshoot bounce.
   * Ideal for BUMP! impact banners, combo announcements, and major callouts.
   */
  public static popPunch(el: HTMLElement, options?: PopPunchOptions) {
    if (!el) return null;
    const sFrom = options?.scaleFrom ?? 0.25;
    const sPeak = options?.scalePeak ?? 1.34;
    const sTo = options?.scaleTo ?? 1.0;
    const rot = options?.rotateDeg ?? 0;
    const yOff = options?.yOffset ?? 0;
    const duration = options?.duration ?? 0.38;

    return animate(
      el,
      {
        scale: [sFrom, sPeak, 0.94, sTo],
        rotate: [rot, -rot * 0.5, 0],
        y: [yOff, -yOff * 0.3, 0],
        opacity: [0, 1, 1, 1],
      },
      {
        duration,
        ease: [0.175, 0.885, 0.32, 1.28],
      }
    );
  }

  /**
   * Snappy exit shrink with graceful opacity fade.
   */
  public static exitShrink(el: HTMLElement, options?: { scaleTo?: number; duration?: number }) {
    if (!el) return null;
    const sTo = options?.scaleTo ?? 0.75;
    const duration = options?.duration ?? 0.16;

    return animate(
      el,
      {
        scale: sTo,
        opacity: 0,
      },
      {
        duration,
        ease: [0.4, 0.0, 1, 1],
      }
    );
  }

  /**
   * Elastic bounce slide down from top with overshoot landing.
   * Ideal for ephemeral event notification cards and alert toasts.
   */
  public static bounceSlideDown(el: HTMLElement, options?: SlideDownOptions) {
    if (!el) return null;
    const yFrom = options?.yFrom ?? -36;
    const yPeak = options?.yPeak ?? 6;
    const sFrom = options?.scaleFrom ?? 0.88;
    const sPeak = options?.scalePeak ?? 1.04;
    const duration = options?.duration ?? 0.36;

    return animate(
      el,
      {
        y: [yFrom, yPeak, -2, 0],
        scale: [sFrom, sPeak, 0.98, 1.0],
        opacity: [0, 1, 1, 1],
      },
      {
        duration,
        ease: [0.175, 0.885, 0.32, 1.25],
      }
    );
  }

  /**
   * Snappy slide-up exit collapse for cards and banners.
   */
  public static slideOutUp(el: HTMLElement, options?: { yTo?: number; duration?: number }) {
    if (!el) return null;
    const yTo = options?.yTo ?? -30;
    const duration = options?.duration ?? 0.18;

    return animate(
      el,
      {
        y: [0, yTo],
        scale: [1.0, 0.92],
        opacity: [1, 0],
      },
      {
        duration,
        ease: [0.4, 0.0, 0.8, 1],
      }
    );
  }

  /**
   * Elastic number / balance / countdown pulse punch.
   * Gives cash delta additions and urgent seconds a tactile heartbeat.
   */
  public static elasticTick(el: HTMLElement, options?: { scalePeak?: number; duration?: number }) {
    if (!el) return null;
    const sPeak = options?.scalePeak ?? 1.32;
    const duration = options?.duration ?? 0.25;

    return animate(
      el,
      {
        scale: [1.0, sPeak, 0.95, 1.0],
      },
      {
        duration,
        ease: [0.175, 0.885, 0.32, 1.3],
      }
    );
  }

  /**
   * Initial spring burst for in-world floating numbers (+$24, -$18).
   */
  public static floatBurst(el: HTMLElement, options?: { scalePeak?: number; rotateDeg?: number }) {
    if (!el) return null;
    const sPeak = options?.scalePeak ?? 1.45;
    const rot = options?.rotateDeg ?? 0;

    return animate(
      el,
      {
        scale: [0.35, sPeak, 0.95, 1.0],
        rotate: [rot, 0],
      },
      {
        duration: 0.32,
        ease: [0.175, 0.885, 0.32, 1.32],
      }
    );
  }

  /**
   * Quick horizontal impact tremor for combo timeouts and damage alarms.
   */
  public static shake(el: HTMLElement, options?: { distance?: number; duration?: number }) {
    if (!el) return null;
    const dist = options?.distance ?? 8;
    const duration = options?.duration ?? 0.32;

    return animate(
      el,
      {
        x: [0, -dist, dist, -dist * 0.5, dist * 0.5, 0],
      },
      {
        duration,
        ease: 'easeInOut',
      }
    );
  }

  /**
   * Dramatic cinematic scale slam entrance for major match outcomes (e.g. ROUND COMPLETE).
   */
  public static zoomSlam(el: HTMLElement, options?: { scaleFrom?: number; duration?: number }) {
    if (!el) return null;
    const sFrom = options?.scaleFrom ?? 2.2;
    const duration = options?.duration ?? 0.42;

    return animate(
      el,
      {
        scale: [sFrom, 0.95, 1.0],
        opacity: [0, 1, 1],
      },
      {
        duration,
        ease: [0.175, 0.885, 0.32, 1.25],
      }
    );
  }

  /**
   * Modal window spring pop-in (Pause, Settings, Match Results).
   */
  public static modalZoomIn(el: HTMLElement, options?: { duration?: number }) {
    if (!el) return null;
    const duration = options?.duration ?? 0.38;

    return animate(
      el,
      {
        scale: [0.75, 1.05, 0.98, 1.0],
        opacity: [0, 1, 1, 1],
      },
      {
        duration,
        ease: [0.175, 0.885, 0.32, 1.25],
      }
    );
  }

  /**
   * Staggered cascading entry with spring bounce for leaderboard and match results table.
   */
  public static staggerDrop(elements: HTMLElement[], options?: { staggerDelay?: number; duration?: number }) {
    if (!elements || elements.length === 0) return;
    const delayStep = options?.staggerDelay ?? 0.06;
    const duration = options?.duration ?? 0.32;

    elements.forEach((row, idx) => {
      setTimeout(() => {
        animate(
          row,
          {
            y: [-20, 3, 0],
            scale: [0.92, 1.03, 1.0],
            opacity: [0, 1, 1],
          },
          {
            duration,
            ease: [0.175, 0.885, 0.32, 1.25],
          }
        );
      }, idx * delayStep * 1000);
    });
  }

  /**
   * Attaches an ultra-satisfying tactile micro-spring bounce to any clickable button or card.
   * Compresses on pointerdown, bounces slightly past 1.0 on pointerup, then settles.
   */
  public static springPress(el: HTMLElement) {
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      // Don't trigger on right clicks
      if (e.button !== 0) return;
      animate(
        el,
        { scale: 0.92 },
        { duration: 0.12, ease: [0.4, 0, 1, 1] }
      );
    });

    const release = () => {
      animate(
        el,
        { scale: [0.92, 1.06, 1.0] },
        { duration: 0.28, ease: [0.175, 0.885, 0.32, 1.3] }
      );
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', () => {
      animate(el, { scale: 1.0 }, { duration: 0.18, ease: 'easeOut' });
    });
    el.addEventListener('pointercancel', () => {
      animate(el, { scale: 1.0 }, { duration: 0.18, ease: 'easeOut' });
    });
  }
}

if (typeof window !== 'undefined') {
  (window as any).__MotionFX = MotionFX;
}
