"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TypeToConfirmProps = {
  expectedValue: string | number;
  label?: string;
  onConfirmed: () => void;
  disabled?: boolean;
};

export function TypeToConfirm({ expectedValue, label, onConfirmed, disabled }: TypeToConfirmProps) {
  const [inputValue, setInputValue] = useState("");
  const expected = String(expectedValue);
  const isMatch = inputValue === expected;

  return (
    <div className="space-y-2">
      <label className="text-muted-foreground text-xs">
        {label ?? `Type "${expected}" to confirm`}
      </label>
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={expected}
          className="h-8 max-w-[200px] font-mono text-sm"
          disabled={disabled}
        />
        <Button size="sm" onClick={onConfirmed} disabled={!isMatch || disabled}>
          Confirm
        </Button>
      </div>
    </div>
  );
}
