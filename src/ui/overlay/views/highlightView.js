import { makeHighlightPx, denormalizeRect } from "../highlight";

export function renderHighlight(layer, ann, cw, ch) {
  const [x, y, w, h] = denormalizeRect(...ann.rect, cw, ch);
  layer.appendChild(makeHighlightPx({ x, y, w, h }));
}
