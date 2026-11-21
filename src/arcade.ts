export const arcadeWidth = 336;

export const arcadeHeight = 262;

function inArcadeRuntime() {
  if (window.self === window.top) return false;

  try {
    return (
      !window.localStorage ||
      (window.innerWidth <= arcadeWidth + 8 && window.innerHeight <= arcadeHeight + 8)
    );
  } catch {
    return true;
  }
}

export const arcadeEmbedded = inArcadeRuntime();

export const arcadeMode =
  arcadeEmbedded || new URLSearchParams(window.location.search).has('cabinet');
