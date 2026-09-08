"use client";

import * as Select from "@radix-ui/react-select";

export type FieldOption = { id: string; label: string; hint?: string };

function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FieldSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FieldOption[];
}) {
  const selected = options.find((o) => o.id === value);
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        id={id}
        aria-label={label}
        className="select-trigger flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-ink/15 bg-white px-3.5 text-[15px] font-medium text-ink transition-colors hover:border-ink/35"
      >
        <span className="min-w-0 truncate">
          {selected?.label}
          {selected?.hint ? <span className="font-normal text-muted"> — {selected.hint}</span> : null}
        </span>
        <ChevronDown className="shrink-0 text-muted" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="select-content z-[60] max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-white shadow-[0_16px_40px_-16px_rgba(27,20,13,0.35)]"
        >
          <Select.Viewport className="p-1.5">
            {options.map((o) => (
              <Select.Item
                key={o.id}
                value={o.id}
                className="relative flex cursor-pointer items-center gap-2 rounded-lg py-2 pl-8 pr-3 text-sm font-medium outline-none select-none data-[highlighted]:bg-parchment data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <span className="absolute left-2.5 inline-flex">
                  <Select.ItemIndicator>
                    <Check className="text-ember" />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>
                  <span>{o.label}</span>
                  {o.hint ? <span className="font-normal text-muted"> — {o.hint}</span> : null}
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
