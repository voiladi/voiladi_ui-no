import React, { useEffect, useState } from "react";
import { photoUrl } from "@/lib/api";
import { initials } from "@/lib/format";

/* Photo with a neutral initials fallback. Images decode off the main thread so card drags stay smooth. */
export const UserPhoto = ({ src, name = "", className = "", alt, style, ...rest }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const url = photoUrl(src);
  if (!url || failed) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-surface3 font-display font-semibold text-mute ${className}`}
        style={style}
        aria-label={alt || name}
        {...rest}
      >
        <span className="text-[0.9em]">{initials(name) || "?"}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt || name}
      className={`object-cover ${className}`}
      style={style}
      onError={() => setFailed(true)}
      draggable={false}
      decoding="async"
      {...rest}
    />
  );
};
