const twilio = require('/home/sxtnl/dev/smartout.ai/packages/notifications/node_modules/twilio');

// API Key auth: SK... + secret + accountSid
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
  accountSid: 'AC958d8a6f3f069b91c08d32e55520f26d'
});

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
