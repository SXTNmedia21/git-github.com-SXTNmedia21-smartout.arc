import twilio from '/home/sxtnl/dev/smartout.ai/node_modules/twilio/lib/index.js';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const numbers = await client.incomingPhoneNumbers.list();
console.log('Dine Twilio-numre:\n');
for (const n of numbers) {
  const caps = [];
  if (n.capabilities.sms) caps.push('SMS');
  if (n.capabilities.voice) caps.push('Voice');
  if (n.capabilities.mms) caps.push('MMS');
  console.log(`  ${n.phoneNumber}  [${caps.join(', ')}]  ${n.friendlyName || ''}`);
}
if (numbers.length === 0) {
  console.log('  Ingen numre funnet.');
}
