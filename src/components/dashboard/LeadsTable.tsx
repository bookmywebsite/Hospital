'use client';
import { Lead } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, getTierColor, getStatusColor, formatRelativeTime } from '@/lib/utils';
import { Flame, ThermometerSun, Snowflake } from 'lucide-react';
import Link from 'next/link';

const TierIcon = ({ tier }: { tier: string | null }) => {
  if (tier === 'HOT') return <Flame className="h-4 w-4 text-red-500" />;
  if (tier === 'WARM') return <ThermometerSun className="h-4 w-4 text-yellow-500" />;
  return <Snowflake className="h-4 w-4 text-blue-500" />;
};

export function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="border-b bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Lead</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Company</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Last Contact</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/dashboard/leads/${lead.id}`} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(lead.fullName || lead.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{lead.fullName || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">{lead.company || '-'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <TierIcon tier={lead.tier} />
                  <span className="font-medium">{lead.score ?? '-'}</span>
                  {lead.tier && <Badge className={getTierColor(lead.tier)}>{lead.tier}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {lead.lastContactedAt ? formatRelativeTime(lead.lastContactedAt) : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}