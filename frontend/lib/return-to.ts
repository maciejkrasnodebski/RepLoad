export function getSafeReturnPath(
  returnTo: string | null,
  origin: string,
): string {
  if (!returnTo?.startsWith("/")) return "/";

  try {
    const destination = new URL(returnTo, origin);
    if (
      destination.origin !== origin ||
      destination.pathname === "/login" ||
      destination.pathname === "/register"
    ) {
      return "/";
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
