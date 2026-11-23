import handler from '../../api/ai.js';
import { run } from '../../cf/shim.js';

export const onRequest = (ctx) => run(handler, ctx);
