/**
 * Filtra mensagens do TensorFlow Lite (XNNPACK) que o Next.js exibe como Console Error.
 * Deve ser importado antes de qualquer código que use MediaPipe.
 */
if (typeof console !== 'undefined') {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => String(a)).join(' ');
    if (/TensorFlow|XNNPACK|delegate|TFLite/i.test(msg)) return;
    origError.apply(console, args);
  };
  const origInfo = console.info;
  console.info = (...args: unknown[]) => {
    const msg = args.map((a) => String(a)).join(' ');
    if (/TensorFlow|XNNPACK|delegate|TFLite/i.test(msg)) return;
    origInfo.apply(console, args);
  };
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = args.map((a) => String(a)).join(' ');
    if (/TensorFlow|XNNPACK|delegate|TFLite/i.test(msg)) return;
    origWarn.apply(console, args);
  };
}
