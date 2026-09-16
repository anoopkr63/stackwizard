import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 renamed the `middleware` file convention to `proxy` (same behaviour,
// Node.js runtime by default — setting a `runtime` config here throws).
// It runs before the router resolves the URL, which is the only place we can
// catch a malformed percent-escape: `/s/%zz` reaches the dynamic segment,
// Next's decodeURIComponent throws, and the visitor gets a 500.
//
// /s/<combo> already promises that an unknown combo just loads the blank
// wizard, so a broken link goes home instead of erroring. 307 keeps the
// method and says nothing about the link being permanently wrong.
export const config = {
  matcher: "/s/:combo*",
};

export function proxy(request: NextRequest) {
  // `new URL(...).pathname` leaves escapes untouched — decoding here is what
  // tells us whether the router is about to throw on them.
  const { pathname } = new URL(request.url);
  try {
    decodeURIComponent(pathname);
  } catch {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }
  return NextResponse.next();
}
