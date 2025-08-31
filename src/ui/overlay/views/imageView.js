function makeImagePx({ x, y, w, h, src }) {
  const el = document.createElement("div");
  el.className = "image-box";
  Object.assign(el.style, {
    left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
    backgroundImage: `url("${src}")`, backgroundSize: "cover",
    backgroundPosition: "center", backgroundRepeat: "no-repeat",
  });
  return el;
}

export function renderImage(layer, ann, cw, ch) {
  const [nx, ny, nw, nh] = ann.rect;
  const x = nx * cw, y = ny * ch, w = nw * cw, h = nh * ch;
  layer.appendChild(makeImagePx({ x, y, w, h, src: ann.src }));
}
