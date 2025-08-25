/**
 * state.js
 * Centralized app state
 */
export const state = {
  pdfDoc: null,
  pageNum: 1,
  scale: 1.0,

  // "highlight" | "note" | "text" | "image" | null
  tool: null,

  // { [pageNum]: Annotation[] }
  // highlight: { type:'highlight', rect:[x,y,w,h] }
  // note:      { type:'note',      pos:[x,y], text:string }
  // text:      { type:'text',      rect:[x,y,w,h], text:string, fontSize:number, color:string, align:'left'|'center'|'right' }
  // image:     { type:'image',     rect:[x,y,w,h], src:string }  // src is a dataURL
  annotations: {},

  // Per-page PDF.js viewports
  viewports: {},
};
