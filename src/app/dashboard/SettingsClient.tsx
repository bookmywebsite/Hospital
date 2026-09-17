'use client';
import { useState } from 'react';
import {
  Card, CardHeader, CardTitle,
  CardDescription, CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Bot, Mail, Phone, CreditCard } from 'lucide-react';

interface Props {
  agentId: string;
  agentName: string;
  appUrl: string;
}

export function SettingsClient({ agentId, agentName, appUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const embedCode = agentId
    ? `<script>
(function(){
  var s = document.createElement('script');
  s.src = '${appUrl}/widget.js';
  s.async = true;
  s.onload = function(){ window.PrimePro.init({ agentId: '${agentId}' }); };
  document.body.appendChild(s);
})();
</script>`
    : 'Agent not found. Please refresh the page.';

  const copyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const integrations = [
    { name: 'Calendly', icon: Bot, status: 'connected', color: 'text-blue-600' },
    { name: 'SendGrid', icon: Mail, status: 'connected', color: 'text-green-600' },
    { name: 'Twilio', icon: Phone, status: 'connected', color: 'text-red-600' },
    { name: 'Stripe', icon: CreditCard, status: 'connected', color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Chat Widget */}
      <Card>
        <CardHeader>
          <CardTitle>Chat Widget</CardTitle>
          <CardDescription>
            Embed this script on your website to activate the AI chat agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Agent:</span>
            <span className="font-medium text-foreground">{agentName}</span>
            <Badge variant="success" className="ml-1">Active</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Agent ID:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
              {agentId || 'Not found'}
            </code>
          </div>
          <div className="relative">
            <div className="bg-gray-900 rounded-lg p-4 pr-16">
              <pre className="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {embedCode}
              </pre>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={copyCode}
            >
              {copied
                ? <Check className="w-4 h-4 text-green-600" />
                : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this snippet before the closing &lt;/body&gt; tag on your website.
          </p>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connected services and APIs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <item.icon className={`h-5 w-5 ${item.color}`} />
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}