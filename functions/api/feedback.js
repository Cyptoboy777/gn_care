import handler from '../../api/feedback.js';
import { run } from '../../cf/shim.js';

export const onRequest = (ctx) => run(handler, ctx);
