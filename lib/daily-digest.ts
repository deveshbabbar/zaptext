export interface DigestBooking {
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  time_slot: string;
  end_time: string;
  service: string;
  status: string;
  notes: string;
  created_at: string;
}

export interface DigestInput {
  businessName: string;
  date: string;
  bookings: DigestBooking[];
  systemName?: string;
  format: 'csv' | 'json';
}

export interface DigestFile {
  filename: string;
  mimeType: string;
  body: string;
  base64: string;
}

function csvEscape(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function toCsvRow(fields: string[]): string {
  return fields.map(csvEscape).join(',');
}

export function buildDailyDigest(input: DigestInput): DigestFile {
  const { businessName, date, bookings, systemName, format } = input;
  const safeBiz = businessName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'bot';
  const baseName = `${safeBiz}-${date}`;

  if (format === 'json') {
    const payload = {
      generatedAt: new Date().toISOString(),
      businessName,
      date,
      systemName: systemName || null,
      count: bookings.length,
      bookings,
    };
    const body = JSON.stringify(payload, null, 2);
    return {
      filename: `${baseName}.json`,
      mimeType: 'application/json',
      body,
      base64: Buffer.from(body, 'utf8').toString('base64'),
    };
  }

  // CSV
  const header = [
    'booking_id', 'date', 'time_slot', 'end_time',
    'customer_name', 'customer_phone', 'service', 'status', 'notes', 'created_at',
  ];
  const rows = [toCsvRow(header)];
  for (const b of bookings) {
    rows.push(
      toCsvRow([
        b.booking_id || '',
        b.date || '',
        b.time_slot || '',
        b.end_time || '',
        b.customer_name || '',
        b.customer_phone || '',
        b.service || '',
        b.status || '',
        b.notes || '',
        b.created_at || '',
      ])
    );
  }
  const body = rows.join('\r\n') + '\r\n';
  return {
    filename: `${baseName}.csv`,
    mimeType: 'text/csv',
    body,
    base64: Buffer.from(body, 'utf8').toString('base64'),
  };
}

export function digestSubject(businessName: string, date: string, count: number, systemName?: string): string {
  const forPart = systemName ? ` — for ${systemName}` : '';
  return `📋 ${businessName} — ${count} booking${count === 1 ? '' : 's'} on ${date}${forPart}`;
}

export function digestIntroHtml(
  businessName: string,
  date: string,
  count: number,
  systemName?: string,
  format: 'csv' | 'json' = 'csv'
): string {
  const systemBlurb = systemName
    ? `<p>Import the attached <strong>${format.toUpperCase()}</strong> into <strong>${systemName}</strong>, or keep for records.</p>`
    : `<p>Attached: <strong>${format.toUpperCase()}</strong> with today&apos;s orders. You can change the format anytime in Bot Settings.</p>`;
  return `
    <h2>📋 ${businessName} — daily digest</h2>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Bookings/orders:</strong> ${count}</p>
    ${systemBlurb}
    <p style="color:#6F6A5F;font-size:13px;margin-top:16px;">
      Sent nightly by ZapText. To change the format or pause digests, open Bot Settings &rarr; Daily export.
    </p>
  `;
}
