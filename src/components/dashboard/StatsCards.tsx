import { Card, CardContent } from '@/components/ui/card';
import { Users, Flame, MessageSquare, Calendar } from 'lucide-react';

interface StatsCardsProps {
  stats: { totalLeads: number; hotLeads: number; totalConversations: number; meetingsBooked: number };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { title: 'Total Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-600' },
    { title: 'Hot Leads', value: stats.hotLeads, icon: Flame, color: 'text-red-600' },
    { title: 'Conversations', value: stats.totalConversations, icon: MessageSquare, color: 'text-green-600' },
    { title: 'Meetings', value: stats.meetingsBooked, icon: Calendar, color: 'text-purple-600' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold">{card.value}</p>
              </div>
              <card.icon className={`h-10 w-10 ${card.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}