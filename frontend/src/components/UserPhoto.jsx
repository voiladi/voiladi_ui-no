import React, { useEffect, useState } from "react";
import { photoUrl } from "@/lib/api";
import { initials } from "@/lib/format";

/*
 * Photo with a neutral initials fallback. The parent decides the shape (rounded-full for avatars).
 * While the image loads a soft shimmer shows; the photo then fades in (no hard pop-in).
 */
export const UserPhoto = ({ src, name = "", className = "", alt, style, ...rest }) => {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [src]);
  const url = photoUrl(src);
  if (!url || failed) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-surface2 font-semibold text-mute ${className}`}
        style={style}
        aria-label={alt || name}
        {...rest}
      >
        <span className="text-[0.9em]">{initials(name) || "?"}</span>
      </div>
    );
  }
  return (
    <span className={`relative block overflow-hidden ${ready ? "" : "vo-shimmer"} ${className}`} style={style}>
      <img
        src={url}
        alt={alt || name}
        className={`vo-img absolute inset-0 h-full w-full object-cover ${ready ? "vo-img-ready" : ""}`}
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
        draggable={false}
        decoding="async"
        {...rest}
      />
    </span>
  );
};
