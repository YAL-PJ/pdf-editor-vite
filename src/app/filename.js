// src/app/filename.js

/** Build a non-duplicated save name like "file (annotated).pdf". */
export const makeSaveName = (originalName, marker = " (annotated)") => {
  if (!originalName) return "annotated.pdf";
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext  = dot > 0 ? originalName.slice(dot) : ".pdf";
  const escMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleanBase = base.replace(new RegExp(`${escMarker}$`), "");
  return `${cleanBase}${marker}${ext}`;
};

/** Try to extract filename from file input event or File-like objects. */
export const extractOriginalName = (picked) => {
  if (!picked) return null;
  const t = picked && (picked.target || picked.currentTarget);
  const filesFromEvent = t?.files;
  if (filesFromEvent?.[0]?.name) return filesFromEvent[0].name;

  if (picked?.name && typeof picked.name === "string") return picked.name;
  if (picked?.file?.name) return picked.file.name;
  if (typeof File !== "undefined" && picked instanceof File && picked.name) return picked.name;

  return null;
};
