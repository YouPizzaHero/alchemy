// Build a procedural icon DOM node for an element.
(function (global) {
  'use strict';

  function buildIcon(el) {
    const node = document.createElement('div');
    node.className = 'icon icon-' + el.category;
    node.style.setProperty('--tint', el.tint);
    return node;
  }

  global.Icons = { buildIcon };
})(window);
