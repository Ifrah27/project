export async function sendWhatsApp(to, message) {
  const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:3001/send';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, message }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'WhatsApp Local Gateway request failed');
    }

    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('WhatsApp Gateway request timed out');
    }
    throw error;
  }
}

