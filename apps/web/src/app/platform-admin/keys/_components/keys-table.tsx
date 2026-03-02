"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { StatusBadge } from "@/components/platform-admin/status-badge";
import { TagBadge } from "./tag-badge";
import { KeySettingsPopover } from "./key-settings-popover";
import type { ServiceEntry } from "./service-registry";

type SecretStatus = {
  configured: boolean;
  environment: string;
  lastRotatedAt: string | null;
};

type KeysTableProps = {
  services: ServiceEntry[];
  secretStatuses: Map<string, SecretStatus>;
  onUpdated: () => void;
};

export function KeysTable({ services, secretStatuses, onUpdated }: KeysTableProps) {
  if (services.length === 0) {
    return (
      <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
        No keys in this category.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-medium tracking-wider uppercase">Name</TableHead>
            <TableHead className="text-xs font-medium tracking-wider uppercase">Prefix</TableHead>
            <TableHead className="text-xs font-medium tracking-wider uppercase">Tag</TableHead>
            <TableHead className="text-xs font-medium tracking-wider uppercase">Status</TableHead>
            <TableHead className="text-xs font-medium tracking-wider uppercase">
              Environment
            </TableHead>
            <TableHead className="w-[50px] text-xs font-medium tracking-wider uppercase">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => {
            const status = secretStatuses.get(service.key) ?? {
              configured: false,
              environment: "live",
              lastRotatedAt: null,
            };

            return (
              <TableRow key={service.key}>
                <TableCell className="text-sm">
                  <div>
                    <span className="font-medium">{service.label}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                      {service.envVar}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {service.prefix ? (
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                      {service.prefix}***
                    </code>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <TagBadge tag={service.tag} />
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={status.configured ? "configured" : "unconfigured"}
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge status={status.environment || "live"} size="sm" />
                </TableCell>
                <TableCell>
                  <KeySettingsPopover service={service} status={status} onUpdated={onUpdated} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
