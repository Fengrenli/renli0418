// Polyfill for util.inherits (required for ExcelJS in browser)
declare global {
  interface Window {
    util?: {
      inherits?: (ctor: any, superCtor: any) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  if (!window.util) {
    window.util = {};
  }
  if (!window.util.inherits) {
    window.util.inherits = function(ctor: any, superCtor: any) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  }
}

