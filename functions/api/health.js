import handler from '../../api/health.js';
import { run } from '../../cf/shim.js';

export const onRequest = (ctx) => run(handler, ctx);
