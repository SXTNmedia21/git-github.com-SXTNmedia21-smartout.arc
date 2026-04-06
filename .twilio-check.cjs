/**
 * Quick Twilio number check — lists all phone numbers on the account.
 * Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in env.
 * Run: op run --env-file=.env.template -- node .twilio-check.cjs
 */
const twilio = require('twilio');

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;

if (!sid || !token) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(sid, token);

client.incomingPhoneNumbers.list().then(numbers => {
  console.log('Dine Twilio-numre:\n');
  numbers.forEach(n => {
    const caps = [];
    if (n.capabilities.sms) caps.push('SMS');
    if (n.capabilities.voice) caps.push('Voice');
    if (n.capabilities.mms) caps.push('MMS');
    console.log('  ' + n.phoneNumber + '  [' + caps.join(', ') + ']  ' + (n.friendlyName || ''));
  });
  if (numbers.length === 0) console.log('  Ingen numre funnet.');
}).catch(e => console.error('Error:', e.message));
