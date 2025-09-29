import { makeHighlightPx, denormalizeRect } from "../highlight";

export function renderHighlight(layer, ann, cw, ch) {
  const rects = Array.isArray(ann.rects) && ann.rects.length
    ? ann.rects
    : ann.rect
    ? [ann.rect]
    : [];

  for (const rect of rects) {
    if (!Array.isArray(rect) || rect.length !== 4) continue;
    const [x, y, w, h] = denormalizeRect(...rect, cw, ch);
    layer.appendChild(makeHighlightPx({ x, y, w, h }));
  }
}
