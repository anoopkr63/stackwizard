export function GET() {
  return Response.json(
    { status: "ok", service: "stackwizard", time: new Date().toISOString() },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
