// WhatsApp Business approved-template sending + master template library.
//
// Meta's Business Messaging Policy requires that any business-initiated
// message sent OUTSIDE the 24-hour customer-service window use a template
// pre-approved by WhatsApp. Free-form text is only allowed as a reply
// within 24h of the customer's last inbound message.
//
// HOW THIS FILE WORKS
//   - TEMPLATE_NAMES        snake_case identifiers used everywhere in code
//   - TEMPLATE_DEFINITIONS  body/category/language per template per locale
//   - getTemplatePayload()  builds the exact JSON Meta's Graph API expects
//                           for the /{WABA_ID}/message_templates endpoint
//   - sendWhatsAppTemplate  sends an APPROVED template to a customer
//   - pickTemplateLanguage  picks 'en' or 'hi' based on customer's lang
//
// SETUP (one-time per WABA):
//   1. Set WHATSAPP_BUSINESS_ACCOUNT_ID in .env
//   2. Run `pnpm tsx scripts/submit-templates.ts` to submit all to Meta
//   3. Wait 1–24h for approval; check /admin/templates for status
//   4. Once APPROVED, sendWhatsAppTemplate() will work
//
// MARGIN NOTE: utility templates cost ₹0.115 per send (Meta India, Jan 2026).
// Marketing templates cost ₹0.86 — 7.5× more. Keep everything UTILITY unless
// the message is genuinely promotional with no operational purpose.

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

// ─── template identifiers ────────────────────────────────────────────────

export const TEMPLATE_NAMES = {
  // A. Onboarding & activation
  BOT_ACTIVATED: 'bot_activated',
  EMPLOYEE_INVITE: 'employee_invite',
  CUSTOMER_OPT_IN_CONFIRM: 'customer_opt_in_confirm',

  // B. Appointments / bookings
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_REMINDER: 'booking_reminder',
  BOOKING_RESCHEDULE: 'booking_reschedule',
  BOOKING_CANCELLATION: 'booking_cancellation',
  BOOKING_NO_SHOW_FOLLOWUP: 'booking_no_show_followup',

  // C. Staff / employee ops
  SHIFT_AVAILABILITY_CHECK: 'shift_availability_check',
  SHIFT_ASSIGNMENT: 'shift_assignment',
  SHIFT_SWAP_REQUEST: 'shift_swap_request',
  SHIFT_CANCELLATION: 'shift_cancellation',

  // D. Payments
  PAYMENT_REQUEST: 'payment_request',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_REMINDER: 'payment_reminder',
  INVOICE_READY: 'invoice_ready',

  // E. Orders / delivery
  ORDER_CONFIRMATION: 'order_confirmation',
  ORDER_DISPATCHED: 'order_dispatched',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',

  // F. Authentication
  OTP_LOGIN: 'otp_login',

  // G. Feedback & loyalty
  FEEDBACK_REQUEST: 'feedback_request',

  // H. Membership / renewals
  MEMBERSHIP_EXPIRING: 'membership_expiring',
  MEMBERSHIP_RENEWED: 'membership_renewed',

  // I. Reports & documents
  DOCUMENT_READY: 'document_ready',
} as const;

export type TemplateName = typeof TEMPLATE_NAMES[keyof typeof TEMPLATE_NAMES];

export type TemplateCategory = 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
export type TemplateLanguage = 'en' | 'hi';

// One body definition per (template, language). Variables use {{1}}, {{2}}, …
// `example` values are required by Meta's review process — they reject
// templates without realistic examples.
export interface TemplateBody {
  body: string;                // body text with {{N}} placeholders
  variables: string[];         // ordered names — for docs only
  example: string[];           // sample values matching variables, for Meta
  footer?: string;             // optional fixed footer (no variables)
}

export interface TemplateDefinition {
  name: TemplateName;
  category: TemplateCategory;
  description: string;         // human-readable purpose
  bodies: Record<TemplateLanguage, TemplateBody>;
}

// ─── master template definitions ─────────────────────────────────────────

export const TEMPLATE_DEFINITIONS: Record<TemplateName, TemplateDefinition> = {
  // ─── A. Onboarding ────────────────────────────────────────────────────

  [TEMPLATE_NAMES.BOT_ACTIVATED]: {
    name: TEMPLATE_NAMES.BOT_ACTIVATED,
    category: 'UTILITY',
    description: 'Sent to owner when their bot goes live.',
    bodies: {
      en: {
        body: 'Your WhatsApp bot for {{1}} is now active. Customers messaging this number will be replied to automatically. Manage at {{2}}.',
        variables: ['business_name', 'dashboard_url'],
        example: ['Sharma Tiffin Service', 'https://zaptext.shop/client'],
      },
      hi: {
        body: '{{1}} ke liye aapka WhatsApp bot ab active hai. Is number par message karne wale customers ko automatic reply milega. Manage karein: {{2}}.',
        variables: ['business_name', 'dashboard_url'],
        example: ['Sharma Tiffin Service', 'https://zaptext.shop/client'],
      },
    },
  },

  [TEMPLATE_NAMES.EMPLOYEE_INVITE]: {
    name: TEMPLATE_NAMES.EMPLOYEE_INVITE,
    category: 'UTILITY',
    description: 'Sent to a newly added staff member. Captures opt-in.',
    bodies: {
      en: {
        body: 'Hi {{1}}, you have been added to {{2}}\'s team on WhatsApp. You will receive shift updates and availability requests here. Reply YES to confirm, STOP to opt out.',
        variables: ['employee_name', 'business_name'],
        example: ['Rohan', 'FitZone Gym'],
      },
      hi: {
        body: 'Namaste {{1}}, aapko {{2}} ki team mein add kiya gaya hai. Aapko yahan shift updates aur availability requests milengi. Confirm karne ke liye YES, opt out ke liye STOP reply karein.',
        variables: ['employee_name', 'business_name'],
        example: ['Rohan', 'FitZone Gym'],
      },
    },
  },

  [TEMPLATE_NAMES.CUSTOMER_OPT_IN_CONFIRM]: {
    name: TEMPLATE_NAMES.CUSTOMER_OPT_IN_CONFIRM,
    category: 'UTILITY',
    description: 'Confirms a customer opted in to updates.',
    bodies: {
      en: {
        body: 'Thanks {{1}}. You are now subscribed to updates from {{2}}. Reply STOP anytime to unsubscribe.',
        variables: ['customer_name', 'business_name'],
        example: ['Anita', 'Sharma Tiffin Service'],
      },
      hi: {
        body: 'Dhanyavaad {{1}}. Aap ab {{2}} ke updates ke liye subscribed hain. Unsubscribe karne ke liye kabhi bhi STOP reply karein.',
        variables: ['customer_name', 'business_name'],
        example: ['Anita', 'Sharma Tiffin Service'],
      },
    },
  },

  // ─── B. Bookings ──────────────────────────────────────────────────────

  [TEMPLATE_NAMES.BOOKING_CONFIRMATION]: {
    name: TEMPLATE_NAMES.BOOKING_CONFIRMATION,
    category: 'UTILITY',
    description: 'Confirms an appointment after booking is created.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your appointment for {{2}} on {{3}} at {{4}} is confirmed. Booking ID: {{5}}. Reply CANCEL to cancel.',
        variables: ['customer_name', 'service', 'date', 'time', 'booking_id'],
        example: ['Anita', 'Hair Cut', '12 May 2026', '4:30 PM', 'BK-1042'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka {{2}} ka appointment {{3}} ko {{4}} baje confirm ho gaya hai. Booking ID: {{5}}. Cancel karne ke liye CANCEL reply karein.',
        variables: ['customer_name', 'service', 'date', 'time', 'booking_id'],
        example: ['Anita', 'Hair Cut', '12 May 2026', '4:30 PM', 'BK-1042'],
      },
    },
  },

  [TEMPLATE_NAMES.BOOKING_REMINDER]: {
    name: TEMPLATE_NAMES.BOOKING_REMINDER,
    category: 'UTILITY',
    description: 'Reminder sent 24h or 1h before an appointment.',
    bodies: {
      en: {
        body: 'Reminder: {{1}}, your appointment for {{2}} is on {{3}} at {{4}}. See you soon!',
        variables: ['customer_name', 'service', 'date', 'time'],
        example: ['Anita', 'Hair Cut', '12 May 2026', '4:30 PM'],
      },
      hi: {
        body: 'Yaad dilane ke liye: {{1}}, aapka {{2}} ka appointment {{3}} ko {{4}} baje hai. Jald milte hain!',
        variables: ['customer_name', 'service', 'date', 'time'],
        example: ['Anita', 'Hair Cut', '12 May 2026', '4:30 PM'],
      },
    },
  },

  [TEMPLATE_NAMES.BOOKING_RESCHEDULE]: {
    name: TEMPLATE_NAMES.BOOKING_RESCHEDULE,
    category: 'UTILITY',
    description: 'Notifies customer of a rescheduled appointment.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your appointment for {{2}} has been rescheduled to {{3}} at {{4}}. Booking ID: {{5}}.',
        variables: ['customer_name', 'service', 'new_date', 'new_time', 'booking_id'],
        example: ['Anita', 'Hair Cut', '13 May 2026', '5:00 PM', 'BK-1042'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka {{2}} ka appointment {{3}} ko {{4}} baje reschedule kar diya gaya hai. Booking ID: {{5}}.',
        variables: ['customer_name', 'service', 'new_date', 'new_time', 'booking_id'],
        example: ['Anita', 'Hair Cut', '13 May 2026', '5:00 PM', 'BK-1042'],
      },
    },
  },

  [TEMPLATE_NAMES.BOOKING_CANCELLATION]: {
    name: TEMPLATE_NAMES.BOOKING_CANCELLATION,
    category: 'UTILITY',
    description: 'Confirms a cancelled booking.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your appointment for {{2}} on {{3}} at {{4}} has been cancelled. Booking ID: {{5}}.',
        variables: ['customer_name', 'service', 'date', 'time', 'booking_id'],
        example: ['Anita', 'Hair Cut', '12 May 2026', '4:30 PM', 'BK-1042'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka {{2}} ka appointment {{3}} ko {{4}} baje cancel ho gaya hai. Booking ID: {{5}}.',
        variables: ['customer_name', 'service', 'date', 'time', 'booking_id'],
        example: ['Anita', 'Hair Cut', '12 May 2026', '4:30 PM', 'BK-1042'],
      },
    },
  },

  [TEMPLATE_NAMES.BOOKING_NO_SHOW_FOLLOWUP]: {
    name: TEMPLATE_NAMES.BOOKING_NO_SHOW_FOLLOWUP,
    category: 'UTILITY',
    description: 'Sent after a customer missed an appointment.',
    bodies: {
      en: {
        body: 'Hi {{1}}, we missed you at your {{2}} appointment on {{3}}. Reply BOOK to reschedule a new slot.',
        variables: ['customer_name', 'service', 'date'],
        example: ['Anita', 'Hair Cut', '12 May 2026'],
      },
      hi: {
        body: 'Namaste {{1}}, aap {{3}} ko {{2}} ke appointment par nahi aaye. Naya slot book karne ke liye BOOK reply karein.',
        variables: ['customer_name', 'service', 'date'],
        example: ['Anita', 'Hair Cut', '12 May 2026'],
      },
    },
  },

  // ─── C. Staff / employee ops ─────────────────────────────────────────

  [TEMPLATE_NAMES.SHIFT_AVAILABILITY_CHECK]: {
    name: TEMPLATE_NAMES.SHIFT_AVAILABILITY_CHECK,
    category: 'UTILITY',
    description: 'Asks staff if they can take a shift.',
    bodies: {
      en: {
        body: 'Hi {{1}}, are you available for the {{2}} shift on {{3}} ({{4}})? Reply YES or NO.',
        variables: ['employee_name', 'shift_label', 'date', 'time_range'],
        example: ['Rohan', 'evening', '12 May 2026', '6:00 PM - 10:00 PM'],
      },
      hi: {
        body: 'Namaste {{1}}, kya aap {{3}} ko {{2}} shift ({{4}}) ke liye available hain? YES ya NO reply karein.',
        variables: ['employee_name', 'shift_label', 'date', 'time_range'],
        example: ['Rohan', 'evening', '12 May 2026', '6:00 PM - 10:00 PM'],
      },
    },
  },

  [TEMPLATE_NAMES.SHIFT_ASSIGNMENT]: {
    name: TEMPLATE_NAMES.SHIFT_ASSIGNMENT,
    category: 'UTILITY',
    description: 'Confirms a shift assignment to staff.',
    bodies: {
      en: {
        body: 'Hi {{1}}, you are scheduled for the {{2}} shift on {{3}} from {{4}}. Location: {{5}}.',
        variables: ['employee_name', 'shift_label', 'date', 'time_range', 'location'],
        example: ['Rohan', 'evening', '12 May 2026', '6:00 PM - 10:00 PM', 'FitZone, Sector 14'],
      },
      hi: {
        body: 'Namaste {{1}}, aapko {{3}} ko {{2}} shift ({{4}}) di gayi hai. Location: {{5}}.',
        variables: ['employee_name', 'shift_label', 'date', 'time_range', 'location'],
        example: ['Rohan', 'evening', '12 May 2026', '6:00 PM - 10:00 PM', 'FitZone, Sector 14'],
      },
    },
  },

  [TEMPLATE_NAMES.SHIFT_SWAP_REQUEST]: {
    name: TEMPLATE_NAMES.SHIFT_SWAP_REQUEST,
    category: 'UTILITY',
    description: 'One staff member requests to swap a shift with another.',
    bodies: {
      en: {
        body: 'Hi {{1}}, {{2}} is requesting to swap their {{3}} shift on {{4}} ({{5}}) with you. Reply ACCEPT or DECLINE.',
        variables: ['recipient_name', 'requester_name', 'shift_label', 'date', 'time_range'],
        example: ['Anjali', 'Rohan', 'evening', '12 May 2026', '6:00 PM - 10:00 PM'],
      },
      hi: {
        body: 'Namaste {{1}}, {{2}} {{4}} ki {{3}} shift ({{5}}) aapke saath swap karna chahte hain. ACCEPT ya DECLINE reply karein.',
        variables: ['recipient_name', 'requester_name', 'shift_label', 'date', 'time_range'],
        example: ['Anjali', 'Rohan', 'evening', '12 May 2026', '6:00 PM - 10:00 PM'],
      },
    },
  },

  [TEMPLATE_NAMES.SHIFT_CANCELLATION]: {
    name: TEMPLATE_NAMES.SHIFT_CANCELLATION,
    category: 'UTILITY',
    description: 'Notifies staff of a cancelled shift.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your {{2}} shift on {{3}} has been cancelled. Reason: {{4}}.',
        variables: ['employee_name', 'shift_label', 'date', 'reason'],
        example: ['Rohan', 'evening', '12 May 2026', 'Low bookings'],
      },
      hi: {
        body: 'Namaste {{1}}, aapki {{3}} ki {{2}} shift cancel kar di gayi hai. Karan: {{4}}.',
        variables: ['employee_name', 'shift_label', 'date', 'reason'],
        example: ['Rohan', 'evening', '12 May 2026', 'Low bookings'],
      },
    },
  },

  // ─── D. Payments ─────────────────────────────────────────────────────

  [TEMPLATE_NAMES.PAYMENT_REQUEST]: {
    name: TEMPLATE_NAMES.PAYMENT_REQUEST,
    category: 'UTILITY',
    description: 'Asks the customer to complete a payment.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your bill for {{2}} is Rs {{3}}. Pay here: {{4}}. Invoice ID: {{5}}.',
        variables: ['customer_name', 'description', 'amount', 'payment_url', 'invoice_id'],
        example: ['Anita', 'Hair Cut', '450', 'https://rzp.io/i/abc123', 'INV-2046'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka {{2}} ka bill Rs {{3}} hai. Yahan pay karein: {{4}}. Invoice ID: {{5}}.',
        variables: ['customer_name', 'description', 'amount', 'payment_url', 'invoice_id'],
        example: ['Anita', 'Hair Cut', '450', 'https://rzp.io/i/abc123', 'INV-2046'],
      },
    },
  },

  [TEMPLATE_NAMES.PAYMENT_RECEIVED]: {
    name: TEMPLATE_NAMES.PAYMENT_RECEIVED,
    category: 'UTILITY',
    description: 'Confirms a successful payment.',
    bodies: {
      en: {
        body: 'Thank you {{1}}! We received your payment of Rs {{2}} for {{3}}. Receipt ID: {{4}}.',
        variables: ['customer_name', 'amount', 'description', 'receipt_id'],
        example: ['Anita', '450', 'Hair Cut', 'RCP-9012'],
      },
      hi: {
        body: 'Dhanyavaad {{1}}! Hume aapka Rs {{2}} ka payment {{3}} ke liye mil gaya. Receipt ID: {{4}}.',
        variables: ['customer_name', 'amount', 'description', 'receipt_id'],
        example: ['Anita', '450', 'Hair Cut', 'RCP-9012'],
      },
    },
  },

  [TEMPLATE_NAMES.PAYMENT_REMINDER]: {
    name: TEMPLATE_NAMES.PAYMENT_REMINDER,
    category: 'UTILITY',
    description: 'Friendly nudge for an overdue payment.',
    bodies: {
      en: {
        body: 'Hi {{1}}, a payment of Rs {{2}} for {{3}} is pending since {{4}}. Pay here: {{5}}.',
        variables: ['customer_name', 'amount', 'description', 'due_date', 'payment_url'],
        example: ['Anita', '450', 'Hair Cut', '5 May 2026', 'https://rzp.io/i/abc123'],
      },
      hi: {
        body: 'Namaste {{1}}, Rs {{2}} ka payment {{3}} ke liye {{4}} se pending hai. Yahan pay karein: {{5}}.',
        variables: ['customer_name', 'amount', 'description', 'due_date', 'payment_url'],
        example: ['Anita', '450', 'Hair Cut', '5 May 2026', 'https://rzp.io/i/abc123'],
      },
    },
  },

  [TEMPLATE_NAMES.INVOICE_READY]: {
    name: TEMPLATE_NAMES.INVOICE_READY,
    category: 'UTILITY',
    description: 'Notifies customer that an invoice is ready.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your invoice {{2}} for Rs {{3}} is ready. View or download: {{4}}.',
        variables: ['customer_name', 'invoice_id', 'amount', 'invoice_url'],
        example: ['Anita', 'INV-2046', '450', 'https://zaptext.shop/inv/2046'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka invoice {{2}} (Rs {{3}}) tayar hai. Yahan dekhein: {{4}}.',
        variables: ['customer_name', 'invoice_id', 'amount', 'invoice_url'],
        example: ['Anita', 'INV-2046', '450', 'https://zaptext.shop/inv/2046'],
      },
    },
  },

  // ─── E. Orders / delivery ────────────────────────────────────────────

  [TEMPLATE_NAMES.ORDER_CONFIRMATION]: {
    name: TEMPLATE_NAMES.ORDER_CONFIRMATION,
    category: 'UTILITY',
    description: 'Confirms a placed order.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your order #{{2}} is confirmed. Total: Rs {{3}}. Expected by {{4}}.',
        variables: ['customer_name', 'order_id', 'total', 'eta'],
        example: ['Anita', '7821', '320', 'Today 8:00 PM'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka order #{{2}} confirm ho gaya hai. Total: Rs {{3}}. Expected by {{4}}.',
        variables: ['customer_name', 'order_id', 'total', 'eta'],
        example: ['Anita', '7821', '320', 'Aaj 8:00 PM'],
      },
    },
  },

  [TEMPLATE_NAMES.ORDER_DISPATCHED]: {
    name: TEMPLATE_NAMES.ORDER_DISPATCHED,
    category: 'UTILITY',
    description: 'Order out for delivery.',
    bodies: {
      en: {
        body: 'Hi {{1}}, order #{{2}} is out for delivery and should arrive by {{3}}. Track here: {{4}}.',
        variables: ['customer_name', 'order_id', 'eta', 'tracking_url'],
        example: ['Anita', '7821', '8:00 PM', 'https://zaptext.shop/track/7821'],
      },
      hi: {
        body: 'Namaste {{1}}, order #{{2}} delivery ke liye nikal chuka hai aur {{3}} tak pahunch jayega. Track karein: {{4}}.',
        variables: ['customer_name', 'order_id', 'eta', 'tracking_url'],
        example: ['Anita', '7821', '8:00 PM', 'https://zaptext.shop/track/7821'],
      },
    },
  },

  [TEMPLATE_NAMES.ORDER_DELIVERED]: {
    name: TEMPLATE_NAMES.ORDER_DELIVERED,
    category: 'UTILITY',
    description: 'Order delivered confirmation.',
    bodies: {
      en: {
        body: 'Hi {{1}}, order #{{2}} has been delivered. Reply 1-5 to rate your experience.',
        variables: ['customer_name', 'order_id'],
        example: ['Anita', '7821'],
      },
      hi: {
        body: 'Namaste {{1}}, order #{{2}} deliver ho gaya hai. Apna anubhav rate karne ke liye 1-5 reply karein.',
        variables: ['customer_name', 'order_id'],
        example: ['Anita', '7821'],
      },
    },
  },

  [TEMPLATE_NAMES.ORDER_CANCELLED]: {
    name: TEMPLATE_NAMES.ORDER_CANCELLED,
    category: 'UTILITY',
    description: 'Order cancellation confirmation with refund window.',
    bodies: {
      en: {
        body: 'Hi {{1}}, order #{{2}} has been cancelled. Any payment will be refunded within {{3}}.',
        variables: ['customer_name', 'order_id', 'refund_window'],
        example: ['Anita', '7821', '5-7 business days'],
      },
      hi: {
        body: 'Namaste {{1}}, order #{{2}} cancel ho gaya hai. Koi bhi payment {{3}} mein refund kar di jayegi.',
        variables: ['customer_name', 'order_id', 'refund_window'],
        example: ['Anita', '7821', '5-7 business days'],
      },
    },
  },

  // ─── F. Authentication ──────────────────────────────────────────────

  [TEMPLATE_NAMES.OTP_LOGIN]: {
    name: TEMPLATE_NAMES.OTP_LOGIN,
    category: 'AUTHENTICATION',
    description: 'One-time password for login or verification.',
    bodies: {
      en: {
        body: '{{1}} is your verification code. For your security, do not share this code.',
        variables: ['otp_code'],
        example: ['438201'],
      },
      hi: {
        body: '{{1}} aapka verification code hai. Apni surakshaa ke liye yeh code kisi ke saath share na karein.',
        variables: ['otp_code'],
        example: ['438201'],
      },
    },
  },

  // ─── G. Feedback ────────────────────────────────────────────────────

  [TEMPLATE_NAMES.FEEDBACK_REQUEST]: {
    name: TEMPLATE_NAMES.FEEDBACK_REQUEST,
    category: 'UTILITY',
    description: 'Asks for a 1-5 rating after a service is completed.',
    bodies: {
      en: {
        body: 'Hi {{1}}, how was your experience with {{2}} on {{3}}? Reply 1 (poor) to 5 (great).',
        variables: ['customer_name', 'service_or_business', 'date'],
        example: ['Anita', 'Hair Cut at FitStyle Salon', '12 May 2026'],
      },
      hi: {
        body: 'Namaste {{1}}, {{3}} ko {{2}} ka anubhav kaisa raha? 1 (kharab) se 5 (badhiya) tak reply karein.',
        variables: ['customer_name', 'service_or_business', 'date'],
        example: ['Anita', 'Hair Cut at FitStyle Salon', '12 May 2026'],
      },
    },
  },

  // ─── H. Membership / renewals ───────────────────────────────────────

  [TEMPLATE_NAMES.MEMBERSHIP_EXPIRING]: {
    name: TEMPLATE_NAMES.MEMBERSHIP_EXPIRING,
    category: 'UTILITY',
    description: 'Reminds member their plan is about to expire.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your {{2}} membership expires on {{3}}. Renew here to avoid interruption: {{4}}.',
        variables: ['customer_name', 'plan_name', 'expiry_date', 'renew_url'],
        example: ['Anita', 'Quarterly Gym', '15 May 2026', 'https://zaptext.shop/renew/abc'],
      },
      hi: {
        body: 'Namaste {{1}}, aapki {{2}} membership {{3}} ko expire ho rahi hai. Bina rukawat ke renew karne ke liye: {{4}}.',
        variables: ['customer_name', 'plan_name', 'expiry_date', 'renew_url'],
        example: ['Anita', 'Quarterly Gym', '15 May 2026', 'https://zaptext.shop/renew/abc'],
      },
    },
  },

  [TEMPLATE_NAMES.MEMBERSHIP_RENEWED]: {
    name: TEMPLATE_NAMES.MEMBERSHIP_RENEWED,
    category: 'UTILITY',
    description: 'Confirms a successful membership renewal.',
    bodies: {
      en: {
        body: 'Thank you {{1}}! Your {{2}} membership is renewed and valid until {{3}}.',
        variables: ['customer_name', 'plan_name', 'new_expiry'],
        example: ['Anita', 'Quarterly Gym', '15 Aug 2026'],
      },
      hi: {
        body: 'Dhanyavaad {{1}}! Aapki {{2}} membership renew ho gayi hai aur {{3}} tak valid hai.',
        variables: ['customer_name', 'plan_name', 'new_expiry'],
        example: ['Anita', 'Quarterly Gym', '15 Aug 2026'],
      },
    },
  },

  // ─── I. Reports / documents ─────────────────────────────────────────

  [TEMPLATE_NAMES.DOCUMENT_READY]: {
    name: TEMPLATE_NAMES.DOCUMENT_READY,
    category: 'UTILITY',
    description: 'Notifies customer that a report or document is ready.',
    bodies: {
      en: {
        body: 'Hi {{1}}, your {{2}} is ready. View or download here: {{3}}.',
        variables: ['customer_name', 'document_label', 'document_url'],
        example: ['Anita', 'lab report', 'https://zaptext.shop/doc/abc123'],
      },
      hi: {
        body: 'Namaste {{1}}, aapka {{2}} tayar hai. Yahan dekhein ya download karein: {{3}}.',
        variables: ['customer_name', 'document_label', 'document_url'],
        example: ['Anita', 'lab report', 'https://zaptext.shop/doc/abc123'],
      },
    },
  },
};

// All approved languages and template names — small helpers for iteration.
export const ALL_TEMPLATE_NAMES = Object.values(TEMPLATE_NAMES) as TemplateName[];
export const ALL_LANGUAGES: TemplateLanguage[] = ['en', 'hi'];

// ─── send / payload helpers ──────────────────────────────────────────

export interface TemplateComponent {
  type: 'body' | 'header' | 'footer' | 'button';
  parameters?: Array<{ type: 'text'; text: string }>;
}

// Picks the best supported template language for a given customer locale.
// We support English + Hindi natively; everything else falls back to English.
// `hi` / `hi-IN` / anything containing "hindi" (case-insensitive) -> Hindi.
export function pickTemplateLanguage(customerLang?: string | null): TemplateLanguage {
  if (!customerLang) return 'en';
  const lc = customerLang.toLowerCase();
  if (lc.startsWith('hi') || lc.includes('hindi')) return 'hi';
  return 'en';
}

// Sends an APPROVED WhatsApp template message. Returns { success, error }.
// On failure, callers MUST NOT fall back to free-form text outside the 24h
// window — Meta will downgrade the account's quality rating.
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  to: string,
  templateName: TemplateName,
  bodyParams: string[] = [],
  languageCode?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'WHATSAPP_ACCESS_TOKEN not set' };
  }
  const lang = languageCode || process.env.WHATSAPP_TEMPLATE_LOCALE || 'en';

  const components: TemplateComponent[] = [];
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text' as const, text })),
    });
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: lang },
            components: components.length > 0 ? components : undefined,
          },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error?.message || data.error?.error_data?.details || 'Unknown WhatsApp error';
      console.error('[whatsapp-template] send failed', {
        template: templateName,
        status: res.status,
        error: errMsg,
      });
      return { success: false, error: errMsg };
    }
    const messageId = data.messages?.[0]?.id as string | undefined;
    return { success: true, messageId };
  } catch (err) {
    console.error('[whatsapp-template] send threw', err);
    return { success: false, error: String(err).slice(0, 300) };
  }
}

// Helper: checks if a customer is within the 24-hour conversation window
// based on the most recent inbound message timestamp. If this returns true,
// free-form sendWhatsAppMessage is permitted; otherwise you MUST use a template.
export function isWithinCustomerServiceWindow(lastInboundAtMs: number | null): boolean {
  if (!lastInboundAtMs) return false;
  const hoursSince = (Date.now() - lastInboundAtMs) / (1000 * 60 * 60);
  return hoursSince < 24;
}

// ─── Meta /message_templates payload builder ────────────────────────

// Builds the JSON payload Meta expects when CREATING a template via the
// POST /{WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates endpoint.
// Reference: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
//
// Shape:
//   { name, language, category, components: [{ type:'BODY', text, example:{ body_text:[[...]] } }] }
//
// AUTHENTICATION-category templates technically support a different shape
// (zero-touch OTP), but Meta also accepts plain BODY for AUTH so we keep
// one uniform shape across all templates for simplicity.
export function getTemplatePayload(name: TemplateName, language: TemplateLanguage) {
  const def = TEMPLATE_DEFINITIONS[name];
  if (!def) throw new Error(`Unknown template: ${name}`);
  const localized = def.bodies[language];
  if (!localized) throw new Error(`Template ${name} has no ${language} body`);

  const components: Array<Record<string, unknown>> = [
    {
      type: 'BODY',
      text: localized.body,
      ...(localized.example.length > 0
        ? { example: { body_text: [localized.example] } }
        : {}),
    },
  ];

  if (localized.footer) {
    components.push({ type: 'FOOTER', text: localized.footer });
  }

  return {
    name,
    language,
    category: def.category,
    components,
  };
}
