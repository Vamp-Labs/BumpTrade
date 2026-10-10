import * as THREE from 'three';
import { GameApp } from './core/GameApp';

async function bootstrap() {
  (window as any).__bootStep = '1_starting';
  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #webgl-canvas not found');
  }

  (window as any).__bootStep = '2_calling_create';
  const app = await GameApp.create(canvas);
  (window as any).__bootStep = '3_create_done';
  app.start();
  (window as any).__bootStep = '4_app_started';

  app.setDebugGlobals(true);
  (window as any).THREE = THREE;

  console.log('🚀 BUMP.TRADE Milestone 3 (Full 5-Vehicle Class Fleet) initialized successfully!');
}

bootstrap().catch((err) => {
  (window as any).__bootStep = 'error: ' + (err?.message || String(err));
  (window as any).__fatalError = err?.message || String(err);
  (window as any).__fatalErrorStack = err?.stack || '';
  console.error('Fatal initialization error:', err);
});
