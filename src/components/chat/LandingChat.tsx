'use client';

import { useState, useEffect } from 'react';
import { ChatWidget } from './ChatWidget';

export function LandingChat() {
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('PrimePro');
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Hi! I'm MedAssist. How can I help you today?"
  );

  useEffect(() => {
    fetch('/api/agent/widget')
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setAgentId(data.id);
        if (data.name) setAgentName(data.name);
        if (data.welcomeMessage) setWelcomeMessage(data.welcomeMessage);
      })
      .catch(() => {});
  }, []);

  if (!agentId) return null;

  return (
    <ChatWidget
      agentId={agentId}
      primaryColor="#4F46E5"
      welcomeMessage={welcomeMessage}
      agentName={agentName}
    />
  );
}