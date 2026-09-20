const split = value => String(value || '').split(',').map(part => part.trim()).filter(Boolean);

function paymentHosts(value) {
  const hosts = new Set();
  for (const raw of split(value)) {
    const host = raw.toLowerCase();
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
      throw new Error(`Invalid COACHING_PAYMENT_HOSTS entry: ${raw}`);
    }
    hosts.add(host);
  }
  return hosts;
}

function currencies(value) {
  if (!value) return new Map();
  let parsed;
  try { parsed = JSON.parse(value); }
  catch { throw new Error('COACHING_CURRENCIES must be a JSON object'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('COACHING_CURRENCIES must be a JSON object');
  const result = new Map();
  for (const [code, exponent] of Object.entries(parsed)) {
    if (!/^[A-Z]{3}$/.test(code) || !Number.isInteger(exponent) || exponent < 0 || exponent > 3) {
      throw new Error(`Invalid COACHING_CURRENCIES entry: ${code}`);
    }
    result.set(code, exponent);
  }
  return result;
}

export function loadCoachingConfig(env = process.env) {
  const trainerIds = new Set(split(env.TRAINER_UIDS));
  const allowedPaymentHosts = paymentHosts(env.COACHING_PAYMENT_HOSTS);
  const supportedCurrencies = currencies(env.COACHING_CURRENCIES);
  return Object.freeze({
    trainerIds,
    allowedPaymentHosts,
    supportedCurrencies,
    feeSetupReady: allowedPaymentHosts.size > 0 && supportedCurrencies.size > 0,
    maxBodyBytes: 500_000,
    origin: env.ORIGIN || 'http://localhost:8080'
  });
}
