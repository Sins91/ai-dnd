/// <reference types="vite/client" />
import type { LocalRpgApi } from '../../shared/contracts';
declare global { interface Window { localRpg: LocalRpgApi; } }
export {};
