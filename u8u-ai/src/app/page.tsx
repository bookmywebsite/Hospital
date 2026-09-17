'use client';

import Link from 'next/link';
import {
  Bot, Mail, Phone, BarChart3, Calendar, Shield,
  ArrowRight, MessageCirclePlus, SquareKanbanIcon, Workflow,
} from 'lucide-react';

export default function HomePage() {
  const features = [
    { icon: MessageCirclePlus, title: '24/7 AI Chat', description: 'Engage visitors instantly with intelligent conversations' },
    { icon: Mail, title: 'Email Automation', description: 'Automated personalized outreach that converts' },
    { icon: Phone, title: 'Voice AI Calls', description: 'Natural phone conversations powered by AI' },
    { icon: BarChart3, title: 'BANT Scoring', description: 'Automatic lead qualification with AI' },
    { icon: Calendar, title: 'Meeting Booking', description: 'Seamless calendar integration' },
    { icon: Shield, title: 'Enterprise Ready', description: 'Secure, scalable, reliable' },
    { icon: Bot, title: 'Custom AI Agents', description: 'Tailor agents to your unique sales process' },
    { icon: SquareKanbanIcon, title: 'CRM Integration', description: 'Sync data with your CRM in real-time' },
    { icon: Workflow, title: 'Full Automation', description: 'Engage leads on their preferred channels' },
  ];

  const comparison = [
    ['Understands customer intent', '✕', '⚠', '✓ Intelligent AI'],
    ['Real-time decision making', 'Rule-based', 'Basic', '✓ Dynamic AI'],
    ['Handles objections', '✕', 'Weak', '✓ Human-like'],
    ['Guides buying decision', '✕', 'Partial', '✓ Smart guidance'],
    ['Closes deals', '✕', '✕', '✓ Revenue-focused'],
    ['Multi-channel support', '✕', 'Partial', '✓ Full coverage'],
    ['Complete system', '✕', '✕', '✓ End-to-End'],
    ['Lead auto-qualification', 'Partial', 'Weak', '✓ BANT scoring'],
    ['Voice AI calling', '✕', '✕', '✓ Native support'],
    ['Works 24/7 autonomously', '✕', 'Partial', '✓ Always on'],
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: '#fff',
    }}>

      {/* Global styles */}
      <style>{`
        html, body { background: #0a0a0f !important; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '20%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Nav ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          background: 'rgba(10,10,15,0.8)',
        }}>
          <nav style={{
            maxWidth: '1200px', margin: '0 auto',
            padding: '0 24px', height: '60px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
                PrimePro<span style={{ color: '#818cf8' }}>.ai</span>
              </span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link href="/sign-up" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '8px 20px', borderRadius: '10px', fontSize: '14px',
                  fontWeight: 500, color: '#fff', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                }}>Sign Up</button>
              </Link>
              <Link href="/sign-in" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '8px 20px', borderRadius: '10px', fontSize: '14px',
                  fontWeight: 500, color: '#fff', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                }}>Sign In</button>
              </Link>
            </div>
          </nav>
        </header>

        {/* ── Hero ── */}
        <section style={{ padding: '96px 24px 80px', textAlign: 'center', maxWidth: '1200px', margin: '0 auto' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '100px', marginBottom: '32px',
            border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)',
            animation: 'fadeUp 0.6s ease both',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
            <span style={{ fontSize: '13px', color: '#a5b4fc', fontWeight: 500 }}>AI Sales Automation for Indian Startups</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
            fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1,
            color: '#fff', marginBottom: '24px',
            animation: 'fadeUp 0.6s ease 0.1s both',
          }}>
            AI Sales Agents That<br />
            <span style={{
              background: 'linear-gradient(135deg, #818cf8, #c4b5fd)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Never Sleep</span>
          </h1>

          <p style={{
            fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)',
            maxWidth: '560px', margin: '0 auto 40px', lineHeight: 1.7,
            animation: 'fadeUp 0.6s ease 0.2s both',
          }}>
            Automate lead qualification, engagement, and meeting booking with AI agents that work 24/7 across chat, email, voice, and WhatsApp.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp 0.6s ease 0.3s both' }}>
            <Link href="/sign-up" style={{ textDecoration: 'none' }}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '13px 28px', borderRadius: '12px', fontSize: '15px',
                fontWeight: 600, color: '#fff', cursor: 'pointer',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', boxShadow: '0 0 36px rgba(99,102,241,0.4)',
              }}>
                Start Free <ArrowRight size={16} />
              </button>
            </Link>
            {/* <Link href="/sign-in" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '13px 28px', borderRadius: '12px', fontSize: '15px',
                fontWeight: 500, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              }}>Sign In</button>
            </Link> */}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', marginTop: '64px', flexWrap: 'wrap', animation: 'fadeUp 0.6s ease 0.4s both' }}>
            {[
              { val: '10x', label: 'More leads contacted' },
              { val: '24/7', label: 'Always working' },
              { val: '10', label: 'Indian languages' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>{s.val}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', marginBottom: '12px' }}>
              Everything You Need
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>One platform. All channels. Zero manual effort.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {features.map((feature) => (
              <div key={feature.title} style={{
                padding: '26px',
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                transition: 'border-color 0.2s, background 0.2s',
                cursor: 'default',
              }}
                onMouseOver={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'rgba(99,102,241,0.3)';
                  el.style.background = 'rgba(99,102,241,0.06)';
                }}
                onMouseOut={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'rgba(255,255,255,0.07)';
                  el.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(99,102,241,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
                }}>
                  <feature.icon size={19} style={{ color: '#818cf8' }} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{feature.title}</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comparison ── */}
        <section style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', marginBottom: '12px' }}>
              Why Teams Choose <span style={{ color: '#818cf8' }}>PrimePro.ai</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>A new standard for intelligent sales systems.</p>
          </div>

          <div style={{
            borderRadius: '20px', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Capability', 'Automation', 'AI Tools', 'PrimePro.ai'].map((h, i) => (
                      <th key={h} style={{
                        padding: '15px 22px',
                        textAlign: i === 0 ? 'left' : 'center',
                        fontWeight: 500, fontSize: '13px',
                        color: i === 3 ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                        background: i === 3 ? 'rgba(99,102,241,0.08)' : 'transparent',
                        letterSpacing: '0.02em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([capability, auto, aiTools, PrimePro], i) => (
                    <tr key={i} style={{ borderBottom: i < comparison.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '13px 22px', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{capability}</td>
                      <td style={{ padding: '13px 22px', textAlign: 'center' }}>
                        <span style={{ color: auto === '✕' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.42)', fontSize: '13px' }}>{auto}</span>
                      </td>
                      <td style={{ padding: '13px 22px', textAlign: 'center' }}>
                        <span style={{ color: aiTools === '✕' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.42)', fontSize: '13px' }}>{aiTools}</span>
                      </td>
                      <td style={{ padding: '13px 22px', textAlign: 'center', background: 'rgba(99,102,241,0.05)' }}>
                        <span style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: 500 }}>{PrimePro}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ padding: '80px 24px 100px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            borderRadius: '24px', padding: '60px 40px', textAlign: 'center',
            border: '1px solid rgba(99,102,241,0.25)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* grid overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', marginBottom: '14px' }}>
                Ready to close more deals?
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginBottom: '36px' }}>
                Start free. No credit card required.
              </p>
              <Link href="/sign-up" style={{ textDecoration: 'none' }}>
                <button style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '13px 32px', borderRadius: '12px', fontSize: '15px',
                  fontWeight: 600, color: '#fff', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', boxShadow: '0 0 40px rgba(99,102,241,0.45)',
                }}>
                  Get Started Free <ArrowRight size={16} />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '28px 24px', textAlign: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: '13px',
        }}>
          © {new Date().getFullYear()} Fuelo Technologies (OPC) Private Limited. Built for Startups.
        </footer>

      </div>
    </div>
  );
}


// import Link from 'next/link';
// import { Button } from '@/components/ui/button';
// import { Bot, Mail, Phone, BarChart3, Calendar, Shield, ArrowRight, CheckCircle, MessageCircle, MessageCirclePlus, SquareKanbanIcon, Workflow } from 'lucide-react';
// import { Agent } from 'http';
// // import { LandingChat } from '@/components/chat/LandingChat';

// export default function HomePage() {
//   const features = [
//     { icon: MessageCirclePlus, title: '24/7 AI Chat', description: 'Engage visitors instantly with intelligent conversations' },
//     { icon: Mail, title: 'Email Automation', description: 'Automated personalized outreach that converts' },
//     { icon: Phone, title: 'Voice AI Calls', description: 'Natural phone conversations powered by AI' },
//     { icon: BarChart3, title: 'BANT Scoring', description: 'Automatic lead qualification with AI' },
//     { icon: Calendar, title: 'Meeting Booking', description: 'Seamless calendar integration' },
//     { icon: Shield, title: 'Enterprise Ready', description: 'Secure, scalable, reliable' },
//     { icon: Bot, title: 'Custom AI Agents', description: 'Tailor agents to your unique sales process' },
//     { icon: SquareKanbanIcon, title: 'CRM Integration', description: 'Sync data with your CRM in real-time' },
//     { icon: Workflow, title: 'Full Automation', description: 'Engage leads on their preferred channels' },
//   ];

//   const plans = [
//     { name: 'Free', price: '₹0', conversations: '50', features: ['Chat only', '1 Agent', 'Basic analytics'] },
//     { name: 'Starter', price: '₹1,999', conversations: '200', features: ['Chat + Email', '2 Agents', 'BANT scoring', 'Email sequences'] },
//     { name: 'Growth', price: '₹4,999', conversations: '500', features: ['All channels', '5 Agents', 'CRM sync', 'Priority support'], popular: true },
//     { name: 'Pro', price: '₹9,999', conversations: '2000', features: ['Everything', 'Unlimited agents', 'Voice calls', 'API access', 'Custom training'] },
//   ];

//   return (
//     <div className="min-h-screen bg-white">
//       <header className="border-b">
//         <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
//           <Link href="/" className="text-2xl font-bold">PrimePro<span className="text-primary">.ai</span></Link>
//           <div className="flex items-center gap-4">
//             <Link href="/sign-up"><Button>Sign Up</Button></Link>
//             <Link href="/sign-in"><Button variant="ghost">Sign In</Button></Link>
//           </div>
//         </nav>
//       </header>

//       <section className="py-20 text-center">
//         <div className="container mx-auto px-4">
//           <h1 className="text-5xl font-bold mb-6">AI Sales Agents That<br /><span className="text-primary">Never Sleep</span></h1>
//           <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">Automate lead qualification, engagement, and meeting booking with AI agents that work 24/7.</p>
//           <div className="flex gap-4 justify-center">
//             <Link href="/sign-up"><Button size="lg" className='border-2'>Start Free <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
//             {/* <Link href="#pricing"><Button variant="outline" size="lg">View Pricing</Button></Link> */}
//           </div>
//         </div>
//       </section>

//       <section className="py-20 bg-gray-50">
//         <div className="container mx-auto px-4">
//           <h2 className="text-3xl font-bold text-center mb-12">Everything You Need</h2>
//           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
//             {features.map((feature) => (
//               <div key={feature.title} className="bg-white p-6 rounded-xl border">
//                 <feature.icon className="h-10 w-10 text-primary mb-4" />
//                 <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
//                 <p className="text-gray-600">{feature.description}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>
//       {/* Why Teams Choose PrimePro.ai */}
//       <section className="py-20">
//         <div className="container mx-auto px-4">
//           <div className="text-center mb-12">
//             <h2 className="text-3xl font-bold mb-3">
//               Why Teams Choose <span className="text-primary">PrimePro.ai</span>
//             </h2>
//             <p className="text-gray-500">A new standard for intelligent sales systems.</p>
//           </div>

//           <div className="overflow-x-auto">
//             <table className="w-full border-collapse text-sm">
//               <thead>
//                 <tr>
//                   <th className="px-6 py-4 text-center text-black font-medium bg-gray-50 border-b">Capability</th>
//                   <th className="px-6 py-4 text-center text-black font-medium bg-gray-50 border-b">Automation</th>
//                   <th className="px-6 py-4 text-center text-black font-medium bg-gray-50 border-b">AI Tools</th>
//                   <th className="px-6 py-4 text-center text-black font-medium bg-gray-50 border-b">PrimePro.ai</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {[
//                   ['Understands customer intent', '✕', '⚠', '✓ Intelligent AI'],
//                   ['Real-time decision making', 'Rule-based', 'Basic', '✓ Dynamic AI'],
//                   ['Handles objections', '✕', 'Weak', '✓ Human-like'],
//                   ['Guides buying decision', '✕', 'Partial', '✓ Smart guidance'],
//                   ['Closes deals', '✕', '✕', '✓ Revenue-focused'],
//                   ['Multi-channel support', '✕', 'Partial', '✓ Full coverage'],
//                   ['Complete system', '✕', '✕', '✓ End-to-End'],
//                   ['Lead auto-qualification', 'Partial', 'Weak', '✓ BANT scoring'],
//                   ['Voice AI calling', '✕', '✕', '✓ Native support'],
//                   ['Works 24/7 autonomously', '✕', 'Partial', '✓ Always on'],
//                 ].map(([capability, auto, aiTools, PrimePro], i) => (
//                   <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
//                     <td className="px-6 py-3 text-gray-700 border-b text-center">{capability}</td>
//                     <td className="px-6 py-3 text-center border-b">
//                       <span className={auto === '✕' ? 'text-red-500' : auto === '⚠' ? 'text-yellow-500' : 'text-yellow-600 text-l font-medium'}>{auto}</span>
//                     </td>
//                     <td className="px-6 py-3 text-center border-b">
//                       <span className={aiTools === '✕' ? 'text-red-500' : 'text-yellow-600 text-l font-medium'}>{aiTools}</span>
//                     </td>
//                     <td className="px-6 py-3 text-center  border-b ">
//                       <span className="text-violet-600 text-l font-bold">{PrimePro}</span>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       </section>
//       <footer className="border-t py-8 text-center text-gray-500">
//         <p>© {new Date().getFullYear()} Fuelo Technologies (OPC) Private Limited. Built for Startups.</p>
//       </footer>

//     </div>
//   );
// }