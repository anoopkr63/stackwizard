export function GET() {
  const body = `Contact: mailto:anoopkr6300@gmail.com
Expires: 2027-09-09T00:00:00.000Z
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
